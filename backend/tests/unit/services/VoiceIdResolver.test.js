/**
 * Test suite for VoiceIdResolver
 * Tests voice ID resolution with hit, miss->fallback scenarios
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { VoiceIdResolver } from '../../../src/services/VoiceIdResolver.js';
import { logger } from '../../../src/infrastructure/logging/Logger.js';

// Mock logger
jest.mock('../../../src/infrastructure/logging/Logger.js', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe('VoiceIdResolver', () => {
  let mockConfig;
  let mockLoadConfigFn;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock config
    mockConfig = {
      defaultVoices: {
        'en': null, // Note: 'en' is null in actual config
        'english': '77a8b81df32f482f851684c5e2ebb0d2',
        'ar': null,
        'arabic': 'cfa6efa1cb9b46abb1dc7fb128d5622f',
        'he': null,
        'hebrew': '4ebba0f2f4944d2aa75d21552764c638',
        'ko': null,
        'korean': 'bef4755ca1f442359c2fe6420690c8f7',
        'spanish': '5fbecc8a2585441aab29ca46a5cd9356',
        'french': '5531756441d34f408e7e60821f2e52a6',
        'german': 'aa4d2850c70640ca989ca073e5c3c771',
        'italian': '750533f27c5649979110086898518280',
        'portuguese': '6c0a95599317428a8151293305deceba',
        'japanese': '289430c137354573a3ab773c91f05094',
        'chinese': 'de6ad44022104ac0872392d1139e9364',
        'persian': '44efc076bc8d4349931245c7748250c8',
        'urdu': '1ef3312fdf2347f8a7f3e9bcbf26144f',
        'russian': 'bc69c9589d6747028dc5ec4aec2b43c3',
        'turkish': '61646c861eb64e2d9036d8db51385356',
      },
    };

    mockLoadConfigFn = jest.fn().mockReturnValue(mockConfig);
  });

  describe('Constructor', () => {
    it('should create VoiceIdResolver with default voice ID', () => {
      const resolver = new VoiceIdResolver();
      expect(resolver).toBeInstanceOf(VoiceIdResolver);
      expect(resolver.defaultVoiceId).toBe('77a8b81df32f482f851684c5e2ebb0d2');
    });

    it('should create VoiceIdResolver with custom default voice ID', () => {
      const customVoiceId = 'custom-voice-id-123';
      const resolver = new VoiceIdResolver(customVoiceId);
      expect(resolver.defaultVoiceId).toBe(customVoiceId);
    });

    it('should throw error if defaultVoiceId is invalid', () => {
      expect(() => new VoiceIdResolver(null)).toThrow('defaultVoiceId must be a non-empty string');
      expect(() => new VoiceIdResolver('')).toThrow('defaultVoiceId must be a non-empty string');
      expect(() => new VoiceIdResolver(123)).toThrow('defaultVoiceId must be a non-empty string');
    });

    it('should accept custom loadConfigFn', () => {
      const resolver = new VoiceIdResolver('default-voice', mockLoadConfigFn);
      expect(resolver.loadConfigFn).toBe(mockLoadConfigFn);
    });
  });

  describe('resolve - Hit Cases', () => {
    it('should resolve voice ID for Hebrew (he)', () => {
      const resolver = new VoiceIdResolver('default-voice', mockLoadConfigFn);
      const voiceId = resolver.resolve('he');

      expect(voiceId).toBe('4ebba0f2f4944d2aa75d21552764c638');
      expect(mockLoadConfigFn).toHaveBeenCalled();
    });

    it('should resolve voice ID for Arabic (ar)', () => {
      const resolver = new VoiceIdResolver('default-voice', mockLoadConfigFn);
      const voiceId = resolver.resolve('ar');

      expect(voiceId).toBe('cfa6efa1cb9b46abb1dc7fb128d5622f');
    });

    it('should resolve voice ID for English (en)', () => {
      const resolver = new VoiceIdResolver('default-voice', mockLoadConfigFn);
      const voiceId = resolver.resolve('en');

      expect(voiceId).toBe('77a8b81df32f482f851684c5e2ebb0d2'); // Should use 'english' mapping
    });

    it('should resolve voice ID for Korean (ko)', () => {
      const resolver = new VoiceIdResolver('default-voice', mockLoadConfigFn);
      const voiceId = resolver.resolve('ko');

      expect(voiceId).toBe('bef4755ca1f442359c2fe6420690c8f7');
    });

    it('should resolve voice ID for full language names', () => {
      const resolver = new VoiceIdResolver('default-voice', mockLoadConfigFn);

      expect(resolver.resolve('hebrew')).toBe('4ebba0f2f4944d2aa75d21552764c638');
      expect(resolver.resolve('arabic')).toBe('cfa6efa1cb9b46abb1dc7fb128d5622f');
      expect(resolver.resolve('english')).toBe('77a8b81df32f482f851684c5e2ebb0d2');
    });

    it('should resolve voice ID for language variants', () => {
      const resolver = new VoiceIdResolver('default-voice', mockLoadConfigFn);

      expect(resolver.resolve('he-IL')).toBe('4ebba0f2f4944d2aa75d21552764c638');
      expect(resolver.resolve('ar-SA')).toBe('cfa6efa1cb9b46abb1dc7fb128d5622f');
      expect(resolver.resolve('en-US')).toBe('77a8b81df32f482f851684c5e2ebb0d2');
      expect(resolver.resolve('ko-KR')).toBe('bef4755ca1f442359c2fe6420690c8f7');
    });

    it('should resolve voice ID for case-insensitive input', () => {
      const resolver = new VoiceIdResolver('default-voice', mockLoadConfigFn);

      expect(resolver.resolve('HE')).toBe('4ebba0f2f4944d2aa75d21552764c638');
      expect(resolver.resolve('Ar')).toBe('cfa6efa1cb9b46abb1dc7fb128d5622f');
      expect(resolver.resolve('EnGlIsH')).toBe('77a8b81df32f482f851684c5e2ebb0d2');
    });

    it('should cache config after first load', () => {
      const resolver = new VoiceIdResolver('default-voice', mockLoadConfigFn);

      resolver.resolve('he');
      resolver.resolve('ar');
      resolver.resolve('en');

      // Should only call loadConfig once (cached)
      expect(mockLoadConfigFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('resolve - Miss Cases (Fallback)', () => {
    it('should fallback to default voice ID for unknown language', () => {
      const defaultVoiceId = 'fallback-voice-id-123';
      const resolver = new VoiceIdResolver(defaultVoiceId, mockLoadConfigFn);

      const voiceId = resolver.resolve('xx'); // Unknown language

      expect(voiceId).toBe(defaultVoiceId);
      expect(logger.warn).toHaveBeenCalledWith(
        '[VoiceIdResolver] No voice mapping found for language, using default',
        expect.objectContaining({
          languageCode: 'xx',
          normalizedLang: 'en',
          defaultVoiceId,
        })
      );
    });

    it('should fallback to default voice ID when config is null', () => {
      const defaultVoiceId = 'fallback-voice-id-456';
      const nullConfigFn = jest.fn().mockReturnValue(null);
      const resolver = new VoiceIdResolver(defaultVoiceId, nullConfigFn);

      const voiceId = resolver.resolve('he');

      expect(voiceId).toBe(defaultVoiceId);
      expect(logger.warn).toHaveBeenCalledWith(
        '[VoiceIdResolver] Voices config not available, using default voice',
        expect.objectContaining({
          languageCode: 'he',
          defaultVoiceId,
        })
      );
    });

    it('should fallback to default voice ID when defaultVoices is missing', () => {
      const defaultVoiceId = 'fallback-voice-id-789';
      const invalidConfigFn = jest.fn().mockReturnValue({}); // No defaultVoices
      const resolver = new VoiceIdResolver(defaultVoiceId, invalidConfigFn);

      const voiceId = resolver.resolve('he');

      expect(voiceId).toBe(defaultVoiceId);
      expect(logger.warn).toHaveBeenCalledWith(
        '[VoiceIdResolver] Voices config not available, using default voice',
        expect.objectContaining({
          languageCode: 'he',
          defaultVoiceId,
        })
      );
    });

    it('should fallback to default voice ID when language mapping exists but is null', () => {
      const defaultVoiceId = 'fallback-voice-id-999';
      // 'en' is null in config, should fallback
      const resolver = new VoiceIdResolver(defaultVoiceId, mockLoadConfigFn);

      // Even though 'en' exists in config, it's null, so should try 'english' first
      // But if 'english' also doesn't work, should fallback
      const voiceId = resolver.resolve('en');

      // Should use 'english' mapping, not fallback
      expect(voiceId).toBe('77a8b81df32f482f851684c5e2ebb0d2');
    });

    it('should fallback when full name mapping also returns null', () => {
      const defaultVoiceId = 'fallback-voice-id-111';
      const configWithNulls = {
        defaultVoices: {
          'he': null,
          'hebrew': null, // Both are null
          'english': '77a8b81df32f482f851684c5e2ebb0d2',
        },
      };
      const nullConfigFn = jest.fn().mockReturnValue(configWithNulls);
      const resolver = new VoiceIdResolver(defaultVoiceId, nullConfigFn);

      const voiceId = resolver.resolve('he');

      expect(voiceId).toBe(defaultVoiceId);
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('resolve - Edge Cases', () => {
    it('should handle null languageCode', () => {
      const resolver = new VoiceIdResolver('default-voice', mockLoadConfigFn);
      const voiceId = resolver.resolve(null);

      // Should normalize to 'en' and use 'english' mapping
      expect(voiceId).toBe('77a8b81df32f482f851684c5e2ebb0d2');
    });

    it('should handle undefined languageCode', () => {
      const resolver = new VoiceIdResolver('default-voice', mockLoadConfigFn);
      const voiceId = resolver.resolve(undefined);

      // Should normalize to 'en' and use 'english' mapping
      expect(voiceId).toBe('77a8b81df32f482f851684c5e2ebb0d2');
    });

    it('should handle empty string languageCode', () => {
      const resolver = new VoiceIdResolver('default-voice', mockLoadConfigFn);
      const voiceId = resolver.resolve('');

      // Should normalize to 'en' and use 'english' mapping
      expect(voiceId).toBe('77a8b81df32f482f851684c5e2ebb0d2');
    });

    it('should handle whitespace-only languageCode', () => {
      const resolver = new VoiceIdResolver('default-voice', mockLoadConfigFn);
      const voiceId = resolver.resolve('   ');

      // Should normalize to 'en' and use 'english' mapping
      expect(voiceId).toBe('77a8b81df32f482f851684c5e2ebb0d2');
    });

    it('should handle config load error gracefully', () => {
      const defaultVoiceId = 'fallback-voice-id-error';
      const errorConfigFn = jest.fn().mockImplementation(() => {
        throw new Error('Config load failed');
      });
      const resolver = new VoiceIdResolver(defaultVoiceId, errorConfigFn);

      const voiceId = resolver.resolve('he');

      expect(voiceId).toBe(defaultVoiceId);
      expect(logger.error).toHaveBeenCalledWith(
        '[VoiceIdResolver] Failed to load voices config',
        expect.objectContaining({
          error: expect.stringContaining('Config load failed'),
        })
      );
    });
  });

  describe('clearCache', () => {
    it('should clear config cache', () => {
      const resolver = new VoiceIdResolver('default-voice', mockLoadConfigFn);

      // First call - loads config
      resolver.resolve('he');
      expect(mockLoadConfigFn).toHaveBeenCalledTimes(1);

      // Second call - uses cache
      resolver.resolve('ar');
      expect(mockLoadConfigFn).toHaveBeenCalledTimes(1);

      // Clear cache
      resolver.clearCache();

      // Third call - loads config again
      resolver.resolve('en');
      expect(mockLoadConfigFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Language Normalization', () => {
    it('should normalize various language code formats', () => {
      const resolver = new VoiceIdResolver('default-voice', mockLoadConfigFn);

      // All should resolve to Hebrew voice
      expect(resolver.resolve('he')).toBe('4ebba0f2f4944d2aa75d21552764c638');
      expect(resolver.resolve('he-IL')).toBe('4ebba0f2f4944d2aa75d21552764c638');
      expect(resolver.resolve('HE')).toBe('4ebba0f2f4944d2aa75d21552764c638');
      expect(resolver.resolve('Hebrew')).toBe('4ebba0f2f4944d2aa75d21552764c638');
      expect(resolver.resolve('hebrew')).toBe('4ebba0f2f4944d2aa75d21552764c638');
    });

    it('should handle multiple language codes correctly', () => {
      const resolver = new VoiceIdResolver('default-voice', mockLoadConfigFn);

      const results = {
        he: resolver.resolve('he'),
        ar: resolver.resolve('ar'),
        en: resolver.resolve('en'),
        ko: resolver.resolve('ko'),
        es: resolver.resolve('es'),
        fr: resolver.resolve('fr'),
        de: resolver.resolve('de'),
        it: resolver.resolve('it'),
        pt: resolver.resolve('pt'),
        ja: resolver.resolve('ja'),
        zh: resolver.resolve('zh'),
      };

      expect(results.he).toBe('4ebba0f2f4944d2aa75d21552764c638');
      expect(results.ar).toBe('cfa6efa1cb9b46abb1dc7fb128d5622f');
      expect(results.en).toBe('77a8b81df32f482f851684c5e2ebb0d2');
      expect(results.ko).toBe('bef4755ca1f442359c2fe6420690c8f7');
      expect(results.es).toBe('5fbecc8a2585441aab29ca46a5cd9356');
      expect(results.fr).toBe('5531756441d34f408e7e60821f2e52a6');
      expect(results.de).toBe('aa4d2850c70640ca989ca073e5c3c771');
      expect(results.it).toBe('750533f27c5649979110086898518280');
      expect(results.pt).toBe('6c0a95599317428a8151293305deceba');
      expect(results.ja).toBe('289430c137354573a3ab773c91f05094');
      expect(results.zh).toBe('de6ad44022104ac0872392d1139e9364');
    });
  });
});

