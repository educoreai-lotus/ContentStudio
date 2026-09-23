import axios from 'axios';
import { randomUUID } from 'crypto';
import { logger } from '../../../infrastructure/logging/Logger.js';
import { ContentDataCleaner } from '../../utils/ContentDataCleaner.js';
import { NarrationBundleService } from '../../../services/narration-bundle/NarrationBundleService.js';
import { NarratedPresentationVideoService } from '../../../services/narrated-video/NarratedPresentationVideoService.js';
import { AvatarVideoStorageService } from '../../../infrastructure/storage/AvatarVideoStorageService.js';

/**
 * Download presentation PDF bytes from a public storage URL.
 * Reuses the same axios arraybuffer pattern as GenerateAvatarVideoFromPresentationUseCase.
 *
 * @param {string} presentationUrl
 * @param {{ getFn?: Function }} [options]
 * @returns {Promise<Buffer>}
 */
export async function downloadPresentationBuffer(presentationUrl, { getFn = null } = {}) {
  if (!presentationUrl || typeof presentationUrl !== 'string') {
    throw new Error('presentationUrl is required to download presentation buffer');
  }

  const get = getFn || ((url, opts) => axios.get(url, opts));
  const response = await get(presentationUrl, { responseType: 'arraybuffer' });
  const buffer = Buffer.from(response.data);

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Downloaded presentation buffer is empty');
  }

  return buffer;
}

/**
 * Upload NarrationBundle combined audio buffer once (storage only — no TTS).
 *
 * @param {{
 *   combinedAudioBuffer: Buffer,
 *   audioFormat?: string,
 *   storageClient: { uploadFile: Function },
 *   topicName?: string,
 * }} params
 * @returns {Promise<{ audioUrl: string, sha256Hash?: string, digitalSignature?: string }>}
 */
export async function uploadCombinedLessonAudio({
  combinedAudioBuffer,
  audioFormat = 'mp3',
  storageClient,
  topicName = 'lesson',
}) {
  if (!storageClient || typeof storageClient.uploadFile !== 'function') {
    throw new Error('storageClient.uploadFile is required for combined audio upload');
  }
  if (!Buffer.isBuffer(combinedAudioBuffer) || combinedAudioBuffer.length === 0) {
    throw new Error('combinedAudioBuffer must be a non-empty Buffer');
  }

  const safeTopic = String(topicName)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40);
  const fileName = `personalized_narration_${safeTopic}_${Date.now()}_${randomUUID().slice(0, 8)}.${audioFormat}`;

  const uploadResult = await storageClient.uploadFile(
    combinedAudioBuffer,
    fileName,
    `audio/${audioFormat}`
  );

  if (!uploadResult?.url) {
    throw new Error('Combined audio upload did not return a public URL');
  }

  return {
    audioUrl: uploadResult.url,
    sha256Hash: uploadResult.sha256Hash || null,
    digitalSignature: uploadResult.digitalSignature || null,
  };
}

/**
 * Upload narrated presentation MP4 via AvatarVideoStorageService.
 *
 * @param {{
 *   videoBuffer: Buffer,
 *   topicName?: string,
 *   avatarVideoStorage?: { uploadVideoToStorage: Function },
 * }} params
 */
export async function uploadNarratedPresentationVideo({
  videoBuffer,
  topicName = 'lesson',
  avatarVideoStorage = null,
}) {
  if (!Buffer.isBuffer(videoBuffer) || videoBuffer.length === 0) {
    throw new Error('videoBuffer must be a non-empty Buffer');
  }

  const storage = avatarVideoStorage || new AvatarVideoStorageService();
  const safeTopic = String(topicName)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40);
  const fileName = `presentation_narration_${safeTopic}_${Date.now()}_${randomUUID().slice(0, 8)}.mp4`;

  const uploaded = await storage.uploadVideoToStorage(videoBuffer, fileName, 'video/mp4');

  return {
    videoUrl: uploaded.fileUrl,
    fileUrl: uploaded.fileUrl,
    fileName: uploaded.fileName,
    fileSize: uploaded.fileSize,
    fileType: uploaded.fileType || 'video/mp4',
    storagePath: uploaded.storagePath,
    uploadedAt: uploaded.uploadedAt,
    sha256Hash: uploaded.sha256Hash,
    digitalSignature: uploaded.digitalSignature,
  };
}

/**
 * Build Type-1 content_data from NarrationBundle + uploaded combined audio URL.
 *
 * @param {{
 *   narrationBundle: {
 *     combinedText: string,
 *     combinedAudioDuration: number,
 *     audioVoice?: string,
 *     audioFormat?: string,
 *   },
 *   audioUrl: string,
 *   sha256Hash?: string|null,
 *   digitalSignature?: string|null,
 * }} params
 */
export function buildType1FromNarrationBundle({
  narrationBundle,
  audioUrl,
  sha256Hash = null,
  digitalSignature = null,
}) {
  return ContentDataCleaner.cleanTextAudioData({
    text: narrationBundle.combinedText,
    audioUrl,
    audioFormat: narrationBundle.audioFormat || 'mp3',
    audioDuration: narrationBundle.combinedAudioDuration,
    audioVoice: narrationBundle.audioVoice,
    sha256Hash: sha256Hash || undefined,
    digitalSignature: digitalSignature || undefined,
  });
}

/**
 * Build Type-4 audio content_data from NarrationBundle + the SAME uploaded combined audio URL.
 * No additional TTS or upload — Type1.audioUrl === Type4.audioUrl by design.
 *
 * @param {{
 *   narrationBundle: {
 *     combinedAudioDuration: number,
 *     audioVoice?: string,
 *     audioFormat?: string,
 *   },
 *   audioUrl: string,
 *   sha256Hash?: string|null,
 *   digitalSignature?: string|null,
 * }} params
 */
export function buildType4FromNarrationBundle({
  narrationBundle,
  audioUrl,
  sha256Hash = null,
  digitalSignature = null,
}) {
  return ContentDataCleaner.cleanAudioData({
    audioUrl,
    audioFormat: narrationBundle.audioFormat || 'mp3',
    audioDuration: narrationBundle.combinedAudioDuration,
    audioVoice: narrationBundle.audioVoice,
    sha256Hash: sha256Hash || undefined,
    digitalSignature: digitalSignature || undefined,
  });
}

/**
 * Build Type-6 avatar_video content_data for presentation_narration mode.
 *
 * @param {{
 *   narrationBundle: { combinedText: string },
 *   video: { duration: number },
 *   upload: {
 *     videoUrl: string,
 *     fileUrl: string,
 *     fileName?: string,
 *     fileSize?: number,
 *     fileType?: string,
 *     storagePath?: string,
 *     uploadedAt?: string,
 *     sha256Hash?: string,
 *     digitalSignature?: string,
 *   },
 * }} params
 */
export function buildType6FromNarratedVideo({ narrationBundle, video, upload }) {
  const publicUrl = upload.videoUrl || upload.fileUrl;
  return ContentDataCleaner.cleanAvatarVideoData({
    script: narrationBundle.combinedText,
    videoUrl: publicUrl,
    fileUrl: publicUrl,
    duration_seconds: video.duration,
    videoMode: 'presentation_narration',
    fileName: upload.fileName,
    fileSize: upload.fileSize,
    fileType: upload.fileType || 'video/mp4',
    storagePath: upload.storagePath,
    uploadedAt: upload.uploadedAt,
    sha256Hash: upload.sha256Hash,
    digitalSignature: upload.digitalSignature,
  });
}

/**
 * Orchestrate NarrationBundle → Type-1 + Type-6 from an existing presentation PDF buffer.
 * Does NOT call AIGenerationService.generateText / generateAudio / generateAvatarVideo.
 *
 * @param {{
 *   presentationBuffer: Buffer,
 *   language: string,
 *   topicName: string,
 *   aiGenerationService: {
 *     openaiClient: { generateText: Function },
 *     ttsClient: { generateAudio: Function },
 *     storageClient: { uploadFile: Function },
 *   },
 *   narrationBundleService?: { buildBundle: Function },
 *   narratedVideoService?: { generateVideo: Function },
 *   uploadCombinedAudioFn?: Function,
 *   uploadVideoFn?: Function,
 *   jobId?: string,
 * }} params
 */
export async function buildSynchronizedTextAndVideoFromPresentation({
  presentationBuffer,
  language,
  topicName,
  aiGenerationService,
  narrationBundleService = null,
  narratedVideoService = null,
  uploadCombinedAudioFn = null,
  uploadVideoFn = null,
  jobId = null,
}) {
  if (!aiGenerationService?.openaiClient || !aiGenerationService?.ttsClient) {
    throw new Error('aiGenerationService must expose openaiClient and ttsClient');
  }
  if (!aiGenerationService.storageClient) {
    throw new Error('aiGenerationService.storageClient is required for combined audio upload');
  }

  const bundleService =
    narrationBundleService ||
    new NarrationBundleService({
      openaiClient: aiGenerationService.openaiClient,
      ttsClient: aiGenerationService.ttsClient,
    });

  const videoService = narratedVideoService || new NarratedPresentationVideoService();

  logger.info('[personalizedSynchronizedContent] Building NarrationBundle once', {
    topicName,
    language,
  });

  const narrationBundle = await bundleService.buildBundle({
    presentationBuffer,
    language,
    topicName,
    jobId,
  });

  const uploadAudio =
    uploadCombinedAudioFn ||
    ((args) =>
      uploadCombinedLessonAudio({
        ...args,
        storageClient: aiGenerationService.storageClient,
      }));

  const audioUpload = await uploadAudio({
    combinedAudioBuffer: narrationBundle.combinedAudioBuffer,
    audioFormat: narrationBundle.audioFormat || 'mp3',
    topicName,
  });

  const textContentData = buildType1FromNarrationBundle({
    narrationBundle,
    audioUrl: audioUpload.audioUrl,
    sha256Hash: audioUpload.sha256Hash,
    digitalSignature: audioUpload.digitalSignature,
  });

  const audioContentData = buildType4FromNarrationBundle({
    narrationBundle,
    audioUrl: audioUpload.audioUrl,
    sha256Hash: audioUpload.sha256Hash,
    digitalSignature: audioUpload.digitalSignature,
  });

  logger.info('[personalizedSynchronizedContent] Generating narrated presentation video', {
    topicName,
    slideCount: narrationBundle.slides?.length,
  });

  const video = await videoService.generateVideo({
    presentationBuffer,
    narrationBundle,
    jobId,
  });

  const uploadVideo =
    uploadVideoFn || ((args) => uploadNarratedPresentationVideo(args));

  const videoUpload = await uploadVideo({
    videoBuffer: video.videoBuffer,
    topicName,
  });

  const avatarContentData = buildType6FromNarratedVideo({
    narrationBundle,
    video,
    upload: videoUpload,
  });

  return {
    narrationBundle,
    textContentData,
    audioContentData,
    avatarContentData,
    audioUpload,
    videoUpload,
    video,
  };
}
