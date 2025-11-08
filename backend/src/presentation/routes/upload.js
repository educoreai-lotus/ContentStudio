import express from 'express';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
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

    // Check if Supabase is configured
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        error: {
          code: 'STORAGE_NOT_CONFIGURED',
          message: 'Supabase Storage is not configured',
        },
      });
    }

    // Create Supabase client (using the correct env var names from Railway)
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Generate unique filename
    const fileExt = req.file.originalname.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `presentations/${fileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('media')
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return res.status(500).json({
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Failed to upload file to storage: ' + uploadError.message,
        },
      });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('media')
      .getPublicUrl(filePath);

    // Return file metadata
    res.json({
      success: true,
      data: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        fileUrl: urlData.publicUrl,
        storagePath: filePath,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    next(error);
  }
});

export default router;

