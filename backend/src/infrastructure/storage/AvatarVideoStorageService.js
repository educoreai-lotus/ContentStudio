import { createClient } from '@supabase/supabase-js';
import { logger } from '../logging/Logger.js';
import { FileIntegrityService } from '../security/FileIntegrityService.js';

/**
 * Avatar Video Storage Service
 * Handles uploading avatar videos to Supabase Storage and managing metadata
 */
export class AvatarVideoStorageService {
  constructor() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      logger.warn('[AvatarVideoStorageService] Supabase not configured');
      this.client = null;
      this.bucketName = 'media';
      return;
    }

    this.client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    this.bucketName = process.env.SUPABASE_BUCKET_NAME || 'media';
    this.integrityService = new FileIntegrityService();
  }

  /**
   * Check if Supabase is configured
   * @returns {boolean}
   */
  isConfigured() {
    return this.client !== null;
  }

  /**
   * Upload video to Supabase Storage
   * @param {Buffer} fileBuffer - Video file buffer
   * @param {string} fileName - File name (e.g., 'avatar_12345.mp4')
   * @param {string} contentType - MIME type (default: 'video/mp4')
   * @returns {Promise<Object>} Upload result with full metadata
   */
  async uploadVideoToStorage(fileBuffer, fileName, contentType = 'video/mp4') {
    if (!this.isConfigured()) {
      throw new Error('Supabase Storage is not configured');
    }

    if (!fileBuffer || !(fileBuffer instanceof Buffer) || fileBuffer.length === 0) {
      throw new Error('Invalid video buffer received for upload');
    }

    if (!fileName || typeof fileName !== 'string') {
      throw new Error('File name is required');
    }

    try {
      const fileSize = fileBuffer.length;
      const storagePath = `avatar_videos/${fileName}`;
      const uploadedAt = new Date();

      // Convert Buffer to ArrayBuffer for Supabase
      const arrayBuffer = fileBuffer.buffer.slice(
        fileBuffer.byteOffset,
        fileBuffer.byteOffset + fileBuffer.byteLength,
      );

      logger.info('[AvatarVideoStorageService] Uploading video to Supabase Storage', {
        fileName,
        fileSize,
        storagePath,
        contentType,
      });

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await this.client.storage
        .from(this.bucketName)
        .upload(storagePath, arrayBuffer, {
          contentType,
          cacheControl: '3600',
          upsert: true, // Overwrite if exists
        });

      if (uploadError) {
        logger.error('[AvatarVideoStorageService] Supabase upload error', {
          error: uploadError.message,
          code: uploadError.statusCode,
          storagePath,
        });
        throw new Error(`Supabase storage upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = this.client.storage
        .from(this.bucketName)
        .getPublicUrl(storagePath);

      const publicUrl = urlData?.publicUrl;

      if (!publicUrl) {
        logger.error('[AvatarVideoStorageService] Failed to get public URL from Supabase');
        throw new Error('Failed to get public URL from Supabase storage');
      }

      logger.info('[AvatarVideoStorageService] Video uploaded successfully', {
        fileName,
        fileSize,
        storagePath,
        publicUrl,
      });

      // Generate file hash and digital signature
      let integrityData = { sha256Hash: null, digitalSignature: null };
      try {
        integrityData = await this.integrityService.generateHashAndSignature(fileBuffer);
        if (integrityData.sha256Hash && integrityData.digitalSignature) {
          logger.info('[AvatarVideoStorageService] File integrity protection applied', {
            fileName,
            hasHash: !!integrityData.sha256Hash,
            hasSignature: !!integrityData.digitalSignature,
          });
        } else {
          logger.warn('[AvatarVideoStorageService] File integrity protection not available (private key not configured)');
        }
      } catch (integrityError) {
        logger.warn('[AvatarVideoStorageService] Failed to generate file integrity data', {
          error: integrityError.message,
          fileName,
        });
        // Continue without integrity protection - upload still succeeds
      }

      // Return complete metadata structure
      return {
        fileUrl: publicUrl,
        fileName,
        fileSize,
        fileType: contentType,
        storagePath,
        uploadedAt: uploadedAt.toISOString(),
        sha256Hash: integrityData.sha256Hash,
        digitalSignature: integrityData.digitalSignature,
      };
    } catch (error) {
      logger.error('[AvatarVideoStorageService] Storage upload error', {
        error: error.message,
        stack: error.stack,
        fileName,
      });
      throw new Error(`Failed to upload video to storage: ${error.message}`);
    }
  }

  /**
   * Delete video from Supabase Storage (for rollback)
   * @param {string} storagePath - Storage path to delete
   * @returns {Promise<void>}
   */
  async deleteVideoFromStorage(storagePath) {
    if (!this.isConfigured()) {
      logger.warn('[AvatarVideoStorageService] Supabase not configured, cannot delete file');
      return;
    }

    if (!storagePath || typeof storagePath !== 'string') {
      logger.warn('[AvatarVideoStorageService] Invalid storage path for deletion');
      return;
    }

    try {
      logger.info('[AvatarVideoStorageService] Deleting video from storage (rollback)', {
        storagePath,
      });

      const { error } = await this.client.storage
        .from(this.bucketName)
        .remove([storagePath]);

      if (error) {
        logger.error('[AvatarVideoStorageService] Failed to delete video from storage', {
          error: error.message,
          storagePath,
        });
        // Don't throw - rollback failure is logged but doesn't break the flow
      } else {
        logger.info('[AvatarVideoStorageService] Video deleted successfully (rollback)', {
          storagePath,
        });
      }
    } catch (error) {
      logger.error('[AvatarVideoStorageService] Error during video deletion (rollback)', {
        error: error.message,
        storagePath,
      });
      // Don't throw - rollback failure is logged but doesn't break the flow
    }
  }

  /**
   * Generate signed URL for private buckets (TODO: implement if needed)
   * @param {string} storagePath - Storage path
   * @param {number} expiresIn - Expiration time in seconds (default: 3600)
   * @returns {Promise<string>} Signed URL
   */
  async getSignedUrl(storagePath, expiresIn = 3600) {
    if (!this.isConfigured()) {
      throw new Error('Supabase Storage is not configured');
    }

    // TODO: Implement signed URL generation if bucket is private
    // For now, we use public URLs
    const { data: urlData } = this.client.storage
      .from(this.bucketName)
      .getPublicUrl(storagePath);

    return urlData?.publicUrl || null;
  }
}

