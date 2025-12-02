/**
 * Test suite for HeyGen Avatar Validation
 * Tests avatar selection, validation, and fallback behavior
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { HeygenClient } from '../../../../src/infrastructure/ai/HeygenClient.js';
import { getAvatarId, clearCache } from '../../../../src/infrastructure/ai/heygenAvatarConfig.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

describe('HeygenClient Avatar Validation', () => {
  let originalReadFileSync;
  let originalExistsSync;
  const configPath = path.join(__dirname, '../../../../config/heygen-avatar.json');

  beforeEach(() => {
    jest.clearAllMocks();
    clearCache();
    
    // Save original fs methods
    originalReadFileSync = fs.readFileSync;
    originalExistsSync = fs.existsSync;

    // Mock fs methods
    fs.existsSync = jest.fn(() => true);
    fs.readFileSync = jest.fn(() => {
      return JSON.stringify({
        avatar_id: 'test-avatar-id-123',
        name: 'Test Avatar',
        gender: 'female',
        style: 'natural',
        selectedAt: '2025-01-01T00:00:00.000Z',
      });
    });
  });

  afterEach(() => {
    // Restore original fs methods
    fs.readFileSync = originalReadFileSync;
    fs.existsSync = originalExistsSync;
  });

  describe('Avatar Configuration Loading', () => {
    it('should load avatar ID from config file', () => {
      const avatarId = getAvatarId();
      expect(avatarId).toBe('test-avatar-id-123');
    });

    it('should return null if config file does not exist', () => {
      fs.existsSync = jest.fn(() => false);
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
      // Mock config file missing
      fs.existsSync = jest.fn(() => false);
      clearCache();

      const client = new HeygenClient({ apiKey: 'test-api-key' });

      const result = await client.generateVideo({
        title: 'Test',
        prompt: 'Test prompt',
        language: 'en',
      });

      expect(result.status).toBe('failed');
      expect(result.error).toBe('NO_AVAILABLE_AVATAR');
      expect(result.errorCode).toBe('NO_AVAILABLE_AVATAR');
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

      // Mock successful voice lookup
      const voiceModule = await import('../../../../src/infrastructure/ai/heygenVoicesConfig.js');
      Object.defineProperty(voiceModule, 'getVoiceIdForLanguage', {
        value: jest.fn().mockReturnValue('test-voice-id'),
        writable: true,
        configurable: true,
      });

      const client = new HeygenClient({ apiKey: 'test-api-key' });
      
      // Wait for validation
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await client.generateVideo({
        title: 'Test',
        prompt: 'Test prompt',
        language: 'en',
      });

      expect(result.status).toBe('failed');
      expect(result.error).toBe('NO_AVAILABLE_AVATAR');
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

      // Mock voice lookup
      const voiceModule = await import('../../../../src/infrastructure/ai/heygenVoicesConfig.js');
      Object.defineProperty(voiceModule, 'getVoiceIdForLanguage', {
        value: jest.fn().mockReturnValue('test-voice-id'),
        writable: true,
        configurable: true,
      });

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
      fs.existsSync = jest.fn(() => false);
      clearCache();

      const client = new HeygenClient({ apiKey: 'test-api-key' });

      const result = await client.generateVideo({
        title: 'Test',
        prompt: 'Test prompt',
        language: 'en',
      });

      // Should return error object, not throw
      expect(result).toHaveProperty('status', 'failed');
      expect(result).toHaveProperty('error', 'NO_AVAILABLE_AVATAR');
    });
  });
});

