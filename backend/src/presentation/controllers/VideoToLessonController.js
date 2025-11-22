import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { logger } from '../../infrastructure/logging/Logger.js';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/videos';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `video-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp4|avi|mov|wmv|flv|webm|mkv/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Invalid video file type. Allowed: mp4, avi, mov, wmv, flv, webm, mkv'));
    }
  },
});

/**
 * Video-to-Lesson Controller
 */
export class VideoToLessonController {
  constructor({ 
    videoToLessonUseCase, 
    videoTranscriptionService, 
    contentGenerationOrchestrator,
    qualityCheckService,
    topicRepository,
    courseRepository,
  }) {
    this.videoToLessonUseCase = videoToLessonUseCase;
    this.videoTranscriptionService = videoTranscriptionService;
    this.contentGenerationOrchestrator = contentGenerationOrchestrator;
    this.qualityCheckService = qualityCheckService;
    this.topicRepository = topicRepository;
    this.courseRepository = courseRepository;
    this.upload = upload;
  }

  /**
   * Handle video upload and transformation
   * POST /api/video-to-lesson
   */
  async transform(req, res, next) {
    try {
      const { trainer_id, topic_name, description, course_id } = req.body;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Video file is required',
        });
      }

      if (!trainer_id || !topic_name) {
        return res.status(400).json({
          success: false,
          error: 'trainer_id and topic_name are required',
        });
      }

      // Process video
      const result = await this.videoToLessonUseCase.execute({
        file: req.file.path,
        trainer_id,
        topic_name,
        description,
        course_id: course_id ? parseInt(course_id) : null,
      });

      // Clean up uploaded file after processing
      // TODO: Move to Supabase storage instead of deleting
      // fs.unlinkSync(req.file.path);

      res.status(201).json({
        success: true,
        data: result,
        message: 'Video successfully transformed to lesson',
      });
    } catch (error) {
      // Clean up file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      next(error);
    }
  }

  /**
   * Handle video transcription (YouTube URL or file upload)
   * POST /api/video/transcribe
   */
  async transcribe(req, res, next) {
    try {
      const { youtubeUrl } = req.body;
      const uploadedFile = req.file;

      // Validate input
      if (!youtubeUrl && !uploadedFile) {
        return res.status(400).json({
          success: false,
          error: 'Either youtubeUrl or video file is required',
        });
      }

      if (!this.videoTranscriptionService) {
        return res.status(503).json({
          success: false,
          error: 'Video transcription service is not available',
        });
      }

      let transcriptionResult;

      if (youtubeUrl) {
        // Handle YouTube URL
        logger.info('[VideoToLessonController] Transcribing YouTube URL', { youtubeUrl });
        transcriptionResult = await this.videoTranscriptionService.transcribeYouTube(youtubeUrl);
      } else if (uploadedFile) {
        // Handle file upload
        logger.info('[VideoToLessonController] Transcribing uploaded file', {
          filename: uploadedFile.originalname,
          path: uploadedFile.path,
        });
        transcriptionResult = await this.videoTranscriptionService.transcribeUploadedFile(uploadedFile.path);

        // Clean up uploaded file after processing
        try {
          if (fs.existsSync(uploadedFile.path)) {
            fs.unlinkSync(uploadedFile.path);
          }
        } catch (cleanupError) {
          logger.warn('[VideoToLessonController] Failed to cleanup uploaded file', {
            path: uploadedFile.path,
            error: cleanupError.message,
          });
        }
      }

      // Extract transcript text
      const transcriptText = transcriptionResult.transcript;

      // Step 2: Quality check - verify transcript relevance to topic and skills
      const { topic_id, topic_name, course_id } = req.body;

      // Validate topic_id before proceeding
      if (!topic_id) {
        logger.warn('[VideoToLessonController] Topic ID not provided, skipping quality check and content generation', {
          hasTopicId: !!req.body.topic_id,
        });
        throw new Error('Topic ID is required for quality check and content generation. Please provide topic_id in request body.');
      }

      // Perform quality check on transcript
      if (this.qualityCheckService && this.topicRepository && transcriptText) {
        try {
          logger.info('[VideoToLessonController] Starting quality check on transcript', {
            transcriptLength: transcriptText.length,
            topic_id: parseInt(topic_id),
          });

          // Fetch topic and course data for quality check
          const topic = await this.topicRepository.findById(parseInt(topic_id));
          if (!topic) {
            throw new Error(`Topic not found: ${topic_id}`);
          }

          let courseName = null;
          if (topic.course_id && this.courseRepository) {
            const course = await this.courseRepository.findById(topic.course_id);
            courseName = course?.course_name || null;
          }

          // Extract skills from topic
          const skills = Array.isArray(topic.skills) ? topic.skills : (topic.skills ? [topic.skills] : []);

          // Perform quality check evaluation
          const evaluationResult = await this.qualityCheckService.evaluateContentWithOpenAI({
            courseName: courseName || 'General Course',
            topicName: topic.topic_name || topic_name || 'Untitled Topic',
            skills: skills,
            contentText: transcriptText,
            statusMessages: null, // No status messages for API call
          });

          logger.info('[VideoToLessonController] Quality check completed', {
            topic_id: parseInt(topic_id),
            relevance_score: evaluationResult.relevance_score || evaluationResult.relevance,
            originality_score: evaluationResult.originality_score,
            difficulty_alignment_score: evaluationResult.difficulty_alignment_score,
            consistency_score: evaluationResult.consistency_score,
          });

          // Validate scores - reject if relevance < 60 or originality < 75
          const relevanceScore = evaluationResult.relevance_score || evaluationResult.relevance || 100;
          if (relevanceScore < 60) {
            const errorMsg = `Video transcript failed quality check: Content is not relevant to the lesson topic (Relevance: ${relevanceScore}/100). ${evaluationResult.feedback_summary || 'The video transcript does not match the lesson topic. Please ensure your video is directly related to the topic.'}`;
            logger.warn('[VideoToLessonController] Quality check failed - relevance too low', {
              topic_id: parseInt(topic_id),
              relevance_score: relevanceScore,
              feedback: evaluationResult.feedback_summary,
            });
            return res.status(400).json({
              success: false,
              error: errorMsg,
              errorCode: 'QUALITY_CHECK_FAILED',
              quality_check: {
                relevance_score: relevanceScore,
                originality_score: evaluationResult.originality_score,
                difficulty_alignment_score: evaluationResult.difficulty_alignment_score,
                consistency_score: evaluationResult.consistency_score,
                feedback_summary: evaluationResult.feedback_summary,
              },
            });
          }

          if (evaluationResult.originality_score < 75) {
            const errorMsg = `Video transcript failed quality check: Content appears to be copied or plagiarized (Originality: ${evaluationResult.originality_score}/100). ${evaluationResult.feedback_summary || 'Please ensure your video content is original and not copied from other sources.'}`;
            logger.warn('[VideoToLessonController] Quality check failed - originality too low', {
              topic_id: parseInt(topic_id),
              originality_score: evaluationResult.originality_score,
              feedback: evaluationResult.feedback_summary,
            });
            return res.status(400).json({
              success: false,
              error: errorMsg,
              errorCode: 'QUALITY_CHECK_FAILED',
              quality_check: {
                relevance_score: relevanceScore,
                originality_score: evaluationResult.originality_score,
                difficulty_alignment_score: evaluationResult.difficulty_alignment_score,
                consistency_score: evaluationResult.consistency_score,
                feedback_summary: evaluationResult.feedback_summary,
              },
            });
          }

          logger.info('[VideoToLessonController] Quality check passed, proceeding with content generation', {
            topic_id: parseInt(topic_id),
            relevance_score: relevanceScore,
            originality_score: evaluationResult.originality_score,
          });
        } catch (qualityCheckError) {
          logger.error('[VideoToLessonController] Quality check failed with error', {
            topic_id: parseInt(topic_id),
            error: qualityCheckError.message,
            stack: qualityCheckError.stack,
          });
          // If quality check service fails, we should still allow content generation
          // But log the error for debugging
          logger.warn('[VideoToLessonController] Quality check error, but continuing with content generation', {
            error: qualityCheckError.message,
          });
        }
      } else {
        logger.warn('[VideoToLessonController] Quality check service not available, skipping quality check', {
          hasQualityCheckService: !!this.qualityCheckService,
          hasTopicRepository: !!this.topicRepository,
          hasTranscript: !!transcriptText,
        });
      }

      // Step 3: Generate all lesson formats using ContentGenerationOrchestrator
      let generatedContent = null;
      const progressEvents = [];
      
      if (this.contentGenerationOrchestrator && transcriptText) {
        try {
          logger.info('[VideoToLessonController] Starting automatic content generation from transcript', {
            transcriptLength: transcriptText.length,
          });

          // Get trainer_id from request body or authentication
          const trainer_id = req.body.trainer_id || req.auth?.trainer?.trainer_id || null;

          // Progress callback to collect events
          const onProgress = (format, status, message) => {
            const event = {
              format,
              status,
              message,
              timestamp: new Date().toISOString(),
            };
            progressEvents.push(event);
            logger.info(`[VideoToLessonController] Progress: ${message}`, { format, status });
          };
          
          generatedContent = await this.contentGenerationOrchestrator.generateAll(transcriptText, {
            topic_id: parseInt(topic_id),
            trainer_id,
            topic_name,
            course_id: course_id ? parseInt(course_id) : null,
            onProgress,
          });

          logger.info('[VideoToLessonController] All content formats generated successfully', {
            topic_id: generatedContent.topic_id,
            formatsCount: Object.keys(generatedContent.content_formats).length,
            progressEventsCount: progressEvents.length,
          });
        } catch (orchestratorError) {
          logger.error('[VideoToLessonController] Content generation failed', {
            error: orchestratorError.message,
            stack: orchestratorError.stack,
          });
          // Continue with transcription result even if generation fails
          // The error is logged but not thrown, so the transcription result is still returned
        }
      }

      // Return response with transcription and generated content
      res.status(200).json({
        success: true,
        data: {
          transcript: {
            text: transcriptText,
            source: transcriptionResult.source,
            videoType: transcriptionResult.videoType,
            videoId: transcriptionResult.videoId || null,
          },
          // Include generated content if available
          ...(generatedContent && {
            topic_id: generatedContent.topic_id,
            metadata: generatedContent.metadata,
            content_formats: generatedContent.content_formats,
          }),
          // Include progress events
          progress_events: progressEvents,
        },
        message: generatedContent
          ? 'Video transcribed and all lesson formats generated successfully'
          : 'Video transcribed successfully',
      });
    } catch (error) {
      // Clean up file on error
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          logger.warn('[VideoToLessonController] Failed to cleanup file on error', {
            error: cleanupError.message,
          });
        }
      }

      logger.error('[VideoToLessonController] Transcription failed', {
        error: error.message,
        stack: error.stack,
      });

      next(error);
    }
  }

  /**
   * Get multer middleware for file upload
   * @returns {Function} Multer middleware
   */
  getUploadMiddleware() {
    return this.upload.single('file');
  }
}



