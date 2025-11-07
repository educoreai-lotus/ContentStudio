import { VideoToLessonUseCase } from '../../application/use-cases/VideoToLessonUseCase.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

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
  constructor({ videoToLessonUseCase }) {
    this.videoToLessonUseCase = videoToLessonUseCase;
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
   * Get multer middleware for file upload
   * @returns {Function} Multer middleware
   */
  getUploadMiddleware() {
    return this.upload.single('video');
  }
}



