import axios from 'axios';
import { randomUUID } from 'crypto';
import { logger } from '../../infrastructure/logging/Logger.js';
import { NarrationBundleService } from '../../services/narration-bundle/NarrationBundleService.js';
import { NarratedPresentationVideoService } from '../../services/narrated-video/NarratedPresentationVideoService.js';
import { AvatarVideoStorageService } from '../../infrastructure/storage/AvatarVideoStorageService.js';

/**
 * Detect PDF by URL extension or magic bytes (%PDF).
 * @param {string} url
 * @param {Buffer} buffer
 * @returns {boolean}
 */
export function isPdfPresentationBuffer(url, buffer) {
  const urlLooksPdf =
    typeof url === 'string' && url.toLowerCase().split('?')[0].endsWith('.pdf');
  const magicIsPdf =
    Buffer.isBuffer(buffer) &&
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46;
  return urlLooksPdf || magicIsPdf;
}

/**
 * Trainer-only Type-6 path (when TRAINER_NARRATED_PRESENTATION_ENABLED=true):
 * existing Presentation → PDF buffer → NarrationBundle → narrated MP4 → Type-6 content_data.
 *
 * Does NOT create/overwrite Text, Code, Presentation, or Mind Map.
 * Does NOT call heygen / gamma avatar orchestrator.
 * Does NOT import personalizedSynchronizedContent.
 */
export class GenerateNarratedVideoFromPresentationUseCase {
  /**
   * @param {{
   *   contentRepository: { findById: Function },
   *   openaiClient: { generateText: Function },
   *   ttsClient: { generateAudio: Function },
   *   narrationBundleService?: { buildBundle: Function },
   *   narratedVideoService?: { generateVideo: Function },
   *   avatarVideoStorage?: { uploadVideoToStorage: Function },
   *   downloadFn?: Function,
   * }} deps
   */
  constructor({
    contentRepository,
    openaiClient,
    ttsClient,
    narrationBundleService = null,
    narratedVideoService = null,
    avatarVideoStorage = null,
    downloadFn = null,
  }) {
    if (!contentRepository || typeof contentRepository.findById !== 'function') {
      throw new Error('contentRepository with findById is required');
    }
    if (!openaiClient) {
      throw new Error('openaiClient is required');
    }
    if (!ttsClient || typeof ttsClient.generateAudio !== 'function') {
      throw new Error('ttsClient with generateAudio is required');
    }

    this.contentRepository = contentRepository;
    this.openaiClient = openaiClient;
    this.ttsClient = ttsClient;
    this.narrationBundleService =
      narrationBundleService ||
      new NarrationBundleService({ openaiClient, ttsClient });
    this.narratedVideoService =
      narratedVideoService || new NarratedPresentationVideoService();
    this.avatarVideoStorage = avatarVideoStorage || new AvatarVideoStorageService();
    this.downloadFn =
      downloadFn || ((url, opts) => axios.get(url, opts));
  }

  /**
   * @param {{
   *   presentation_content_id: number|string,
   *   language?: string,
   *   topicName?: string,
   *   jobId?: string,
   * }} request
   * @returns {Promise<{
   *   success: boolean,
   *   content_data: Object,
   *   status?: string,
   *   error?: string,
   *   errorCode?: string,
   * }>}
   */
  async execute({
    presentation_content_id,
    language = 'en',
    topicName = 'lesson',
    jobId = null,
  }) {
    const resolvedJobId = jobId || randomUUID();

    if (!presentation_content_id) {
      return {
        success: false,
        status: 'failed',
        error: 'presentation_content_id is required',
        errorCode: 'PRESENTATION_REQUIRED',
        content_data: {
          videoUrl: null,
          status: 'failed',
          error: 'presentation_content_id is required',
          errorCode: 'PRESENTATION_REQUIRED',
        },
      };
    }

    logger.info('[GenerateNarratedVideoFromPresentation] Starting Trainer narrated Type-6', {
      jobId: resolvedJobId,
      presentation_content_id,
      language,
      topicName,
    });

    const presentationContent = await this.contentRepository.findById(presentation_content_id);

    if (!presentationContent) {
      return this.#failure(
        `Presentation content not found: ${presentation_content_id}`,
        'PRESENTATION_REQUIRED'
      );
    }

    const typeId = presentationContent.content_type_id;
    const isPresentation = typeId === 3 || typeId === '3' || typeId === 'presentation';
    if (!isPresentation) {
      return this.#failure(
        `Content is not a presentation (type: ${typeId})`,
        'PRESENTATION_REQUIRED'
      );
    }

    const presentationFileUrl =
      presentationContent.content_data?.fileUrl ||
      presentationContent.content_data?.presentationUrl ||
      presentationContent.content_data?.url;

    if (!presentationFileUrl || typeof presentationFileUrl !== 'string') {
      return this.#failure(
        'Presentation file URL not found in content data',
        'PRESENTATION_FILE_MISSING'
      );
    }

    let presentationBuffer;
    try {
      const fileResponse = await this.downloadFn(presentationFileUrl, {
        responseType: 'arraybuffer',
      });
      presentationBuffer = Buffer.from(fileResponse.data);
    } catch (error) {
      logger.error('[GenerateNarratedVideoFromPresentation] Download failed', {
        jobId: resolvedJobId,
        error: error.message,
      });
      return this.#failure(
        `Failed to download presentation file: ${error.message}`,
        'PRESENTATION_DOWNLOAD_FAILED'
      );
    }

    if (!Buffer.isBuffer(presentationBuffer) || presentationBuffer.length === 0) {
      return this.#failure(
        'Downloaded presentation buffer is empty',
        'PRESENTATION_DOWNLOAD_FAILED'
      );
    }

    if (!isPdfPresentationBuffer(presentationFileUrl, presentationBuffer)) {
      logger.warn('[GenerateNarratedVideoFromPresentation] Non-PDF presentation rejected', {
        jobId: resolvedJobId,
        presentation_content_id,
        urlSuffix: presentationFileUrl.slice(-32),
      });
      return this.#failure(
        'Narrated presentation video requires a PDF presentation. ' +
          'The existing presentation is PPTX or another unsupported format. ' +
          'Re-generate or upload the presentation as PDF, then retry Type-6.',
        'UNSUPPORTED_PRESENTATION_FORMAT'
      );
    }

    logger.info('[GenerateNarratedVideoFromPresentation] Building NarrationBundle once', {
      jobId: resolvedJobId,
      bufferSize: presentationBuffer.length,
    });

    const narrationBundle = await this.narrationBundleService.buildBundle({
      presentationBuffer,
      language,
      topicName,
      jobId: resolvedJobId,
    });

    logger.info('[GenerateNarratedVideoFromPresentation] Generating narrated MP4', {
      jobId: resolvedJobId,
      slideCount: narrationBundle.slides?.length,
      combinedAudioDuration: narrationBundle.combinedAudioDuration,
    });

    const video = await this.narratedVideoService.generateVideo({
      presentationBuffer,
      narrationBundle,
      jobId: resolvedJobId,
    });

    const safeTopic = String(topicName)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);
    const fileName = `presentation_narration_${safeTopic}_${Date.now()}_${randomUUID().slice(0, 8)}.mp4`;

    const uploaded = await this.avatarVideoStorage.uploadVideoToStorage(
      video.videoBuffer,
      fileName,
      'video/mp4'
    );

    const publicUrl = uploaded.fileUrl || uploaded.videoUrl;
    if (!publicUrl) {
      return this.#failure(
        'Narrated video upload did not return a public URL',
        'UPLOAD_FAILED'
      );
    }

    const content_data = {
      script: narrationBundle.combinedText,
      videoUrl: publicUrl,
      fileUrl: publicUrl,
      duration_seconds: video.duration,
      videoMode: 'presentation_narration',
      fileName: uploaded.fileName || fileName,
      fileSize: uploaded.fileSize,
      fileType: uploaded.fileType || 'video/mp4',
      storagePath: uploaded.storagePath,
      uploadedAt: uploaded.uploadedAt,
      sha256Hash: uploaded.sha256Hash,
      digitalSignature: uploaded.digitalSignature,
    };

    logger.info('[GenerateNarratedVideoFromPresentation] Trainer narrated Type-6 completed', {
      jobId: resolvedJobId,
      duration_seconds: content_data.duration_seconds,
      storagePath: content_data.storagePath,
      videoMode: content_data.videoMode,
    });

    return {
      success: true,
      status: 'completed',
      content_data,
    };
  }

  /**
   * @param {string} error
   * @param {string} errorCode
   */
  #failure(error, errorCode) {
    return {
      success: false,
      status: 'failed',
      error,
      errorCode,
      content_data: {
        videoUrl: null,
        status: 'failed',
        error,
        errorCode,
      },
    };
  }
}
