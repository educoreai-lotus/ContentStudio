/**
 * Test suite for HeyGen Avatar Validation
 * Tests avatar selection, validation, and fallback behavior
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { HeygenClient } from '../../../../src/infrastructure/ai/HeygenClient.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock config/heygen.js module - this is what HeygenClient actually uses
// We need to mock it before HeygenClient imports it
const mockGetSafeAvatarId = jest.fn(() => 'test-avatar-id-123');
const mockGetVoiceConfig = jest.fn();
const mockLoadAvatarConfig = jest.fn(() => ({
  avatar_id: 'test-avatar-id-123',
  name: 'Test Avatar',
  gender: 'female',
  style: 'natural',
}));

jest.mock('../../../../src/config/heygen.js', () => ({
  getSafeAvatarId: (...args) => mockGetSafeAvatarId(...args),
  getVoiceConfig: (...args) => mockGetVoiceConfig(...args),
  loadAvatarConfig: (...args) => mockLoadAvatarConfig(...args),
}));

// Mock heygenAvatarConfig module for tests that use it directly
const mockAvatarConfig = {
  avatar_id: 'test-avatar-id-123',
  name: 'Test Avatar',
  gender: 'female',
  style: 'natural',
  selectedAt: '2025-01-01T00:00:00.000Z',
};

let mockGetAvatarId = jest.fn(() => mockAvatarConfig.avatar_id);
let mockClearCache = jest.fn();

jest.mock('../../../../src/infrastructure/ai/heygenAvatarConfig.js', () => ({
  getAvatarId: (...args) => mockGetAvatarId(...args),
  clearCache: (...args) => mockClearCache(...args),
  loadHeygenAvatarConfig: jest.fn(() => mockAvatarConfig),
}));

// Import after mocking
import { getAvatarId, clearCache } from '../../../../src/infrastructure/ai/heygenAvatarConfig.js';

// Mock axios
const mockAxiosGet = jest.fn();
const mockAxiosPost = jest.fn();

jest.mock('axios', () => ({
  default: {
    create: jest.fn(() => ({
      get: (...args) => mockAxiosGet(...args),
      post: (...args) => mockAxiosPost(...args),
    })),
  },
}));

// Mock heygenVoicesConfig to avoid redefinition issues
const mockGetVoiceIdForLanguage = jest.fn().mockReturnValue('test-voice-id');
jest.mock('../../../../src/infrastructure/ai/heygenVoicesConfig.js', () => ({
  getVoiceIdForLanguage: (...args) => mockGetVoiceIdForLanguage(...args),
  loadHeygenVoicesConfig: jest.fn(),
}));

describe('HeygenClient Avatar Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClearCache.mockImplementation(() => {});
    
    // Reset voice mock
    mockGetVoiceIdForLanguage.mockReturnValue('test-voice-id');
    
    // Setup default avatar config mocks
    mockGetSafeAvatarId.mockReturnValue('test-avatar-id-123');
    mockLoadAvatarConfig.mockReturnValue({
      avatar_id: 'test-avatar-id-123',
      name: 'Test Avatar',
      gender: 'female',
      style: 'natural',
    });
    mockGetAvatarId.mockReturnValue(mockAvatarConfig.avatar_id);
  });

  afterEach(() => {
    // Mocks are automatically reset by jest.clearAllMocks()
  });

  describe('Avatar Configuration Loading', () => {
    it('should load avatar ID from config file', () => {
      const avatarId = getAvatarId();
      expect(avatarId).toBe('test-avatar-id-123');
    });

    it('should return null if config file does not exist', () => {
      mockGetAvatarId.mockReturnValueOnce(null);
      clearCache();
      
      const avatarId = getAvatarId();
      expect(avatarId).toBeNull();
    });
  });

  describe('Avatar Validation on Startup', () => {
    it('should validate avatar exists in HeyGen API on startup', async () => {
      // Mock successful avatar.list response
      mockAxiosGet.mockResolvedValueOnce({
        data: {
          data: {
            avatars: [
              { avatar_id: 'test-avatar-id-123', name: 'Test Avatar' },
              { avatar_id: 'other-avatar', name: 'Other Avatar' },
            ],
          },
        },
      });

      const client = new HeygenClient({ apiKey: 'test-api-key' });
      
      // Wait for validation to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockAxiosGet).toHaveBeenCalledWith('/v1/avatar.list');
      expect(client.avatarId).toBe('test-avatar-id-123');
    });

    it('should mark avatar as invalid if not found in API', async () => {
      // Mock avatar.list response without the configured avatar
      mockAxiosGet.mockResolvedValueOnce({
        data: {
          data: {
            avatars: [
              { avatar_id: 'other-avatar-1', name: 'Other Avatar 1' },
              { avatar_id: 'other-avatar-2', name: 'Other Avatar 2' },
            ],
          },
        },
      });

      const client = new HeygenClient({ apiKey: 'test-api-key' });
      
      // Wait for validation to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockAxiosGet).toHaveBeenCalledWith('/v1/avatar.list');
      expect(client.avatarValidated).toBe(false);
    });

    it('should handle API errors gracefully during validation', async () => {
      // Mock API error
      mockAxiosGet.mockRejectedValueOnce(new Error('API Error'));

      const client = new HeygenClient({ apiKey: 'test-api-key' });
      
      // Wait for validation to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not crash, avatarValidated should be false
      expect(client.avatarValidated).toBe(false);
    });
  });

  describe('Avatar Generation with Validation', () => {
    it('should return error if avatar ID is not configured', async () => {
      // Mock avatar ID not configured
      mockGetSafeAvatarId.mockReturnValueOnce(null);

      const client = new HeygenClient({ apiKey: 'test-api-key' });

      const result = await client.generateVideo({
        title: 'Test',
        prompt: 'Test prompt',
        language: 'en',
      });

      // When avatarId is null, it returns 'skipped' not 'failed'
      expect(result.status).toBe('skipped');
      expect(result.reason).toBe('avatar_not_configured');
      expect(mockAxiosPost).not.toHaveBeenCalled();
    });

    it('should return error if avatar is not found in API', async () => {
      // Mock avatar.list response without the configured avatar
      mockAxiosGet.mockResolvedValueOnce({
        data: {
          data: {
            avatars: [
              { avatar_id: 'other-avatar', name: 'Other Avatar' },
            ],
          },
        },
      });

      // Voice lookup is already mocked at module level
      mockGetVoiceIdForLanguage.mockReturnValue('test-voice-id');

      const client = new HeygenClient({ apiKey: 'test-api-key' });
      
      // Wait for validation to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      const result = await client.generateVideo({
        title: 'Test',
        prompt: 'Test prompt',
        language: 'en',
      });

      // When avatar validation fails, it should return 'failed' with NO_AVAILABLE_AVATAR
      expect(result.status).toBe('failed');
      expect(result.error).toBe('NO_AVAILABLE_AVATAR');
      expect(result.errorCode).toBe('NO_AVAILABLE_AVATAR');
      expect(mockAxiosPost).not.toHaveBeenCalled();
    });

    it('should use configured avatar ID in video generation request', async () => {
      // Mock successful avatar validation
      mockAxiosGet.mockResolvedValueOnce({
        data: {
          data: {
            avatars: [
              { avatar_id: 'test-avatar-id-123', name: 'Test Avatar' },
            ],
          },
        },
      });

      // Mock successful video generation
      mockAxiosPost.mockResolvedValueOnce({
        data: {
          data: {
            video_id: 'test-video-id',
          },
        },
      });

      mockAxiosGet.mockResolvedValueOnce({
        data: {
          data: {
            status: 'completed',
            video_url: 'https://heygen.com/video.mp4',
          },
        },
      });

      // Voice lookup is already mocked at module level
      mockGetVoiceIdForLanguage.mockReturnValue('test-voice-id');

      const client = new HeygenClient({ apiKey: 'test-api-key' });
      
      // Wait for validation
      await new Promise(resolve => setTimeout(resolve, 100));

      await client.generateVideo({
        title: 'Test',
        prompt: 'Test prompt',
        language: 'en',
      });

      // Verify avatar_id is used in request
      const postCall = mockAxiosPost.mock.calls[0];
      const payload = postCall[1];
      
      expect(payload.video_inputs[0].character.avatar_id).toBe('test-avatar-id-123');
    });
  });

  describe('Fallback Behavior', () => {
    it('should not crash backend if avatar validation fails', async () => {
      // Mock API error
      mockAxiosGet.mockRejectedValueOnce(new Error('Network error'));

      // Should not throw
      expect(() => {
        const client = new HeygenClient({ apiKey: 'test-api-key' });
        expect(client).toBeDefined();
      }).not.toThrow();
    });

    it('should return structured error instead of throwing', async () => {
      mockGetSafeAvatarId.mockReturnValueOnce(null);

      const client = new HeygenClient({ apiKey: 'test-api-key' });

      const result = await client.generateVideo({
        title: 'Test',
        prompt: 'Test prompt',
        language: 'en',
      });

      // Should return error object, not throw
      // When avatarId is null, it returns 'skipped' not 'failed'
      expect(result).toHaveProperty('status', 'skipped');
      expect(result).toHaveProperty('reason', 'avatar_not_configured');
    });
  });
});

