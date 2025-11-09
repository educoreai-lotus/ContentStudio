import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Storage Client
 * Handles file storage and retrieval from Supabase Storage
 */
export class SupabaseStorageClient {
  constructor({ supabaseUrl, supabaseKey, bucketName }) {
    if (!supabaseUrl || !supabaseKey) {
      console.warn('Supabase credentials not provided, using mock storage');
      this.client = null;
      return;
    }

    this.client = createClient(supabaseUrl, supabaseKey);
    // Use bucket name from parameter, env var, or default to 'media' (Railway default)
    this.bucketName = bucketName || process.env.SUPABASE_BUCKET_NAME || 'media';
  }

  /**
   * Check if Supabase is configured
   * @returns {boolean} True if configured
   */
  isConfigured() {
    return this.client !== null;
  }

  /**
   * Upload a file to Supabase Storage
   * @param {Buffer} fileBuffer - File buffer to upload
   * @param {string} fileName - File name
   * @param {string} contentType - MIME type (e.g., 'audio/mp3', 'video/mp4')
   * @returns {Promise<Object>} Upload result with URL
   */
  async uploadFile(fileBuffer, fileName, contentType = 'application/octet-stream') {
    if (!this.isConfigured()) {
      console.warn('[SupabaseStorageClient] Not configured, skipping upload');
      return { url: null, path: null };
    }

    try {
      const filePath = `${fileName}`;

      const { data, error } = await this.client.storage
        .from(this.bucketName)
        .upload(filePath, fileBuffer, {
          contentType,
          upsert: true, // Overwrite if exists
        });

      if (error) {
        throw new Error(`Supabase storage error: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = this.client.storage
        .from(this.bucketName)
        .getPublicUrl(filePath);

      return {
        url: urlData.publicUrl,
        path: filePath,
      };
    } catch (error) {
      throw new Error(`Failed to upload file to Supabase: ${error.message}`);
    }
  }

  /**
   * Store lesson content in Supabase Storage
   * @param {string} languageCode - Language code (e.g., 'en', 'he', 'ar')
   * @param {string} lessonId - Lesson/Topic ID
   * @param {Object} contentData - Content data to store
   * @param {string} contentType - Content type (text, code, presentation, etc.)
   * @returns {Promise<string>} Storage path/URL
   */
  async storeLessonContent(languageCode, lessonId, contentData, contentType = 'text') {
    if (!this.isConfigured()) {
      // Mock storage for development
      return `mock://storage/${languageCode}/${lessonId}/${contentType}.json`;
    }

    try {
      const filePath = `${languageCode}/lessons/${lessonId}/${contentType}.json`;
      const fileContent = JSON.stringify(contentData);

      const { data, error } = await this.client.storage
        .from(this.bucketName)
        .upload(filePath, fileContent, {
          contentType: 'application/json',
          upsert: true, // Overwrite if exists
        });

      if (error) {
        throw new Error(`Supabase storage error: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = this.client.storage
        .from(this.bucketName)
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error) {
      throw new Error(`Failed to store content in Supabase: ${error.message}`);
    }
  }

  /**
   * Retrieve lesson content from Supabase Storage
   * @param {string} languageCode - Language code
   * @param {string} lessonId - Lesson/Topic ID
   * @param {string} contentType - Content type
   * @returns {Promise<Object|null>} Content data or null if not found
   */
  async getLessonContent(languageCode, lessonId, contentType = 'text') {
    if (!this.isConfigured()) {
      return null; // Mock returns null
    }

    try {
      const filePath = `${languageCode}/lessons/${lessonId}/${contentType}.json`;

      const { data, error } = await this.client.storage
        .from(this.bucketName)
        .download(filePath);

      if (error || !data) {
        return null;
      }

      const text = await data.text();
      return JSON.parse(text);
    } catch (error) {
      console.warn(`Failed to retrieve content from Supabase: ${error.message}`);
      return null;
    }
  }

  /**
   * Check if lesson content exists in storage
   * @param {string} languageCode - Language code
   * @param {string} lessonId - Lesson/Topic ID
   * @param {string} contentType - Content type
   * @returns {Promise<boolean>} True if exists
   */
  async lessonContentExists(languageCode, lessonId, contentType = 'text') {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      const filePath = `${languageCode}/lessons/${lessonId}/${contentType}.json`;

      const { data, error } = await this.client.storage
        .from(this.bucketName)
        .list(`${languageCode}/lessons/${lessonId}/`);

      if (error || !data) {
        return false;
      }

      return data.some(file => file.name === `${contentType}.json`);
    } catch (error) {
      return false;
    }
  }

  /**
   * Store all lesson formats for a language
   * @param {string} languageCode - Language code
   * @param {string} lessonId - Lesson/Topic ID
   * @param {Object} allFormats - All content formats
   * @returns {Promise<Object>} Storage URLs for each format
   */
  async storeAllFormats(languageCode, lessonId, allFormats) {
    const storageUrls = {};

    for (const [formatType, contentData] of Object.entries(allFormats)) {
      try {
        const url = await this.storeLessonContent(
          languageCode,
          lessonId,
          contentData,
          formatType
        );
        storageUrls[formatType] = url;
      } catch (error) {
        console.error(`Failed to store ${formatType} for ${languageCode}:`, error);
      }
    }

    return storageUrls;
  }

  /**
   * Delete lesson content from storage
   * @param {string} languageCode - Language code
   * @param {string} lessonId - Lesson/Topic ID
   * @returns {Promise<void>}
   */
  async deleteLessonContent(languageCode, lessonId) {
    if (!this.isConfigured()) {
      return;
    }

    try {
      const folderPath = `${languageCode}/lessons/${lessonId}/`;

      const { data: files } = await this.client.storage
        .from(this.bucketName)
        .list(folderPath);

      if (files && files.length > 0) {
        const filePaths = files.map(file => `${folderPath}${file.name}`);
        await this.client.storage
          .from(this.bucketName)
          .remove(filePaths);
      }
    } catch (error) {
      console.error(`Failed to delete lesson content: ${error.message}`);
    }
  }
}

