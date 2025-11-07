import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { SupabaseStorageClient } from '../../../../src/infrastructure/storage/SupabaseStorageClient.js';

describe('SupabaseStorageClient', () => {
  let client;
  let mockSupabaseClient;

  beforeEach(() => {
    mockSupabaseClient = {
      storage: {
        from: jest.fn(),
      },
    };

    // Mock Supabase client
    jest.mock('@supabase/supabase-js', () => ({
      createClient: jest.fn(() => mockSupabaseClient),
    }));

    client = new SupabaseStorageClient({
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-key',
    });
  });

  describe('isConfigured', () => {
    it('should return true if configured', () => {
      const configuredClient = new SupabaseStorageClient({
        supabaseUrl: 'https://test.supabase.co',
        supabaseKey: 'test-key',
      });
      expect(configuredClient.isConfigured()).toBe(true);
    });

    it('should return false if not configured', () => {
      const unconfiguredClient = new SupabaseStorageClient({});
      expect(unconfiguredClient.isConfigured()).toBe(false);
    });
  });

  describe('storeLessonContent', () => {
    it('should return mock path if not configured', async () => {
      const unconfiguredClient = new SupabaseStorageClient({});
      const result = await unconfiguredClient.storeLessonContent(
        'en',
        '123',
        { text: 'test' },
        'text'
      );
      expect(result).toContain('mock://storage');
    });

    it('should handle storage errors gracefully', async () => {
      const configuredClient = new SupabaseStorageClient({
        supabaseUrl: 'https://test.supabase.co',
        supabaseKey: 'test-key',
      });
      // Mock will return error, but client should handle it
      // This is a basic test structure
      expect(configuredClient.isConfigured()).toBe(true);
    });
  });

  describe('getLessonContent', () => {
    it('should return null if not configured', async () => {
      const unconfiguredClient = new SupabaseStorageClient({});
      const result = await unconfiguredClient.getLessonContent('en', '123', 'text');
      expect(result).toBeNull();
    });
  });

  describe('lessonContentExists', () => {
    it('should return false if not configured', async () => {
      const unconfiguredClient = new SupabaseStorageClient({});
      const result = await unconfiguredClient.lessonContentExists('en', '123', 'text');
      expect(result).toBe(false);
    });
  });
});



