import express from 'express';
import multer from 'multer';
import { SupabaseStorageClient } from '../../infrastructure/storage/SupabaseStorageClient.js';
import { logger } from '../../infrastructure/logging/Logger.js';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit (increased for presentations with images/videos)
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, PPT, and PPTX are allowed.'));
    }
  },
});

/**
 * Upload presentation file to Supabase Storage
 * POST /api/upload/presentation
 */
router.post('/presentation', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: {
          code: 'NO_FILE',
          message: 'No file uploaded',
        },
      });
    }

    // Initialize SupabaseStorageClient (uses FileIntegrityService for hash and signature)
    const storageClient = new SupabaseStorageClient({
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      bucketName: process.env.SUPABASE_BUCKET_NAME || 'media',
    });

    if (!storageClient.isConfigured()) {
      return res.status(500).json({
        error: {
          code: 'STORAGE_NOT_CONFIGURED',
          message: 'Supabase Storage is not configured',
        },
      });
    }

    // Generate unique filename
    const fileExt = req.file.originalname.split('.').pop();
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const fileName = `presentations/${timestamp}-${randomStr}.${fileExt}`;

    try {
      // Upload to Supabase Storage using SupabaseStorageClient (includes hash and signature generation)
      const uploadResult = await storageClient.uploadFile(
        req.file.buffer,
        fileName,
        req.file.mimetype
      );

      if (!uploadResult.url || !uploadResult.path) {
        throw new Error('Upload succeeded but no URL or path returned');
      }

      logger.info('[Upload] Manual presentation uploaded with integrity protection', {
        fileName: req.file.originalname,
        storagePath: uploadResult.path,
        hasHash: !!uploadResult.sha256Hash,
        hasSignature: !!uploadResult.digitalSignature,
      });

      // Return file metadata including integrity data
      res.json({
        success: true,
        data: {
          fileName: req.file.originalname,
          fileSize: req.file.size,
          fileType: req.file.mimetype,
          fileUrl: uploadResult.url,
          storagePath: uploadResult.path,
          uploadedAt: new Date().toISOString(),
          sha256Hash: uploadResult.sha256Hash || null,
          digitalSignature: uploadResult.digitalSignature || null,
        },
      });
    } catch (uploadError) {
      logger.error('[Upload] Failed to upload presentation', {
        error: uploadError.message,
        fileName: req.file.originalname,
      });
      return res.status(500).json({
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Failed to upload file to storage: ' + uploadError.message,
        },
      });
    }
  } catch (error) {
    console.error('Upload error:', error);
    next(error);
  }
});

export default router;

