/**
 * Test suite for HeyGenTemplatePayloadBuilder
 * Tests payload building, variable keys, ordering, and validation
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { HeyGenTemplatePayloadBuilder } from '../../../src/services/HeyGenTemplatePayloadBuilder.js';

describe('HeyGenTemplatePayloadBuilder', () => {
  let builder;

  beforeEach(() => {
    builder = new HeyGenTemplatePayloadBuilder();
  });

  describe('buildPayload - Basic Functionality', () => {
    it('should build payload with correct structure', () => {
      const slides = [
        {
          index: 1,
          speakerText: 'Welcome to our presentation',
          imageUrl: 'https://example.com/slide1.png',
        },
        {
          index: 2,
          speakerText: 'This is slide 2',
          imageUrl: 'https://example.com/slide2.png',
        },
      ];

      const payload = builder.buildPayload({
        templateId: 'template-123',
        slides,
        title: 'Test Presentation',
        caption: true,
      });

      expect(payload).toHaveProperty('template_id', 'template-123');
      expect(payload).toHaveProperty('title', 'Test Presentation');
      expect(payload).toHaveProperty('variables');
      expect(payload).toHaveProperty('caption_settings');
      expect(payload.caption_settings).toHaveProperty('enabled', true);
    });

    it('should build variables with correct keys', () => {
      const slides = [
        {
          index: 1,
          speakerText: 'First slide',
          imageUrl: 'https://example.com/slide1.png',
        },
        {
          index: 2,
          speakerText: 'Second slide',
          imageUrl: 'https://example.com/slide2.png',
        },
      ];

      const payload = builder.buildPayload({
        templateId: 'template-123',
        slides,
        title: 'Test',
        caption: false,
      });

      expect(payload.variables).toHaveProperty('image_1');
      expect(payload.variables.image_1).toEqual({ image: { name: 'slide1', url: 'https://example.com/slide1.png' } });
      expect(payload.variables).toHaveProperty('speech_1', 'First slide');
      expect(payload.variables).toHaveProperty('image_2');
      expect(payload.variables.image_2).toEqual({ image: { name: 'slide2', url: 'https://example.com/slide2.png' } });
      expect(payload.variables).toHaveProperty('speech_2', 'Second slide');
    });

    it('should not include keys for non-existent slides', () => {
      const slides = [
        {
          index: 1,
          speakerText: 'First slide',
          imageUrl: 'https://example.com/slide1.png',
        },
        {
          index: 3, // Skip index 2
          speakerText: 'Third slide',
          imageUrl: 'https://example.com/slide3.png',
        },
      ];

      // This should fail validation (indices must be sequential)
      expect(() => {
        builder.buildPayload({
          templateId: 'template-123',
          slides,
          title: 'Test',
          caption: false,
        });
      }).toThrow('Slide indices must be sequential');
    });

    it('should only include variables for existing slides (1-3)', () => {
      const slides = [
        {
          index: 1,
          speakerText: 'First slide',
          imageUrl: 'https://example.com/slide1.png',
        },
        {
          index: 2,
          speakerText: 'Second slide',
          imageUrl: 'https://example.com/slide2.png',
        },
        {
          index: 3,
          speakerText: 'Third slide',
          imageUrl: 'https://example.com/slide3.png',
        },
      ];

      const payload = builder.buildPayload({
        templateId: 'template-123',
        slides,
        title: 'Test',
        caption: false,
      });

      // Should have variables for slides 1-3
      expect(payload.variables).toHaveProperty('image_1');
      expect(payload.variables).toHaveProperty('speech_1');
      expect(payload.variables).toHaveProperty('image_2');
      expect(payload.variables).toHaveProperty('speech_2');
      expect(payload.variables).toHaveProperty('image_3');
      expect(payload.variables).toHaveProperty('speech_3');

      // Should NOT have variables for slides 4-10
      expect(payload.variables).not.toHaveProperty('image_4');
      expect(payload.variables).not.toHaveProperty('speech_4');
      expect(payload.variables).not.toHaveProperty('image_10');
      expect(payload.variables).not.toHaveProperty('speech_10');
    });
  });

  describe('buildPayload - Ordering', () => {
    it('should preserve slide ordering regardless of input order', () => {
      const slides = [
        {
          index: 3,
          speakerText: 'Third slide',
          imageUrl: 'https://example.com/slide3.png',
        },
        {
          index: 1,
          speakerText: 'First slide',
          imageUrl: 'https://example.com/slide1.png',
        },
        {
          index: 2,
          speakerText: 'Second slide',
          imageUrl: 'https://example.com/slide2.png',
        },
      ];

      const payload = builder.buildPayload({
        templateId: 'template-123',
        slides,
        title: 'Test',
        caption: false,
      });

      // Variables should be in correct order (1, 2, 3)
      const variableKeys = Object.keys(payload.variables);
      expect(variableKeys).toEqual(['image_1', 'speech_1', 'image_2', 'speech_2', 'image_3', 'speech_3']);
    });

    it('should handle maximum 10 slides', () => {
      const slides = Array.from({ length: 10 }, (_, i) => ({
        index: i + 1,
        speakerText: `Slide ${i + 1} text`,
        imageUrl: `https://example.com/slide${i + 1}.png`,
      }));

      const payload = builder.buildPayload({
        templateId: 'template-123',
        slides,
        title: 'Test',
        caption: false,
      });

      // Should have variables for all 10 slides
      for (let i = 1; i <= 10; i++) {
        expect(payload.variables).toHaveProperty(`image_${i}`);
        expect(payload.variables).toHaveProperty(`speech_${i}`);
      }

      // Should NOT have variables for slide 11
      expect(payload.variables).not.toHaveProperty('image_11');
      expect(payload.variables).not.toHaveProperty('speech_11');
    });
  });

  describe('buildPayload - Validation', () => {
    it('should reject slides with missing imageUrl', () => {
      const slides = [
        {
          index: 1,
          speakerText: 'First slide',
          // Missing imageUrl
        },
      ];

      expect(() => {
        builder.buildPayload({
          templateId: 'template-123',
          slides,
          title: 'Test',
          caption: false,
        });
      }).toThrow('must have a non-empty imageUrl');
    });

    it('should reject slides with missing speakerText', () => {
      const slides = [
        {
          index: 1,
          imageUrl: 'https://example.com/slide1.png',
          // Missing speakerText
        },
      ];

      expect(() => {
        builder.buildPayload({
          templateId: 'template-123',
          slides,
          title: 'Test',
          caption: false,
        });
      }).toThrow('must have a non-empty speakerText');
    });

    it('should reject slides with empty imageUrl', () => {
      const slides = [
        {
          index: 1,
          speakerText: 'First slide',
          imageUrl: '', // Empty
        },
      ];

      expect(() => {
        builder.buildPayload({
          templateId: 'template-123',
          slides,
          title: 'Test',
          caption: false,
        });
      }).toThrow('must have a non-empty imageUrl');
    });

    it('should reject slides with empty speakerText', () => {
      const slides = [
        {
          index: 1,
          speakerText: '', // Empty
          imageUrl: 'https://example.com/slide1.png',
        },
      ];

      expect(() => {
        builder.buildPayload({
          templateId: 'template-123',
          slides,
          title: 'Test',
          caption: false,
        });
      }).toThrow('must have a non-empty speakerText');
    });

    it('should reject slides with invalid imageUrl (not a URL)', () => {
      const slides = [
        {
          index: 1,
          speakerText: 'First slide',
          imageUrl: 'not-a-valid-url',
        },
      ];

      expect(() => {
        builder.buildPayload({
          templateId: 'template-123',
          slides,
          title: 'Test',
          caption: false,
        });
      }).toThrow('must have a valid URL for imageUrl');
    });

    it('should reject empty slides array', () => {
      expect(() => {
        builder.buildPayload({
          templateId: 'template-123',
          slides: [],
          title: 'Test',
          caption: false,
        });
      }).toThrow('slides array cannot be empty');
    });

    it('should reject more than 10 slides', () => {
      const slides = Array.from({ length: 11 }, (_, i) => ({
        index: i + 1,
        speakerText: `Slide ${i + 1}`,
        imageUrl: `https://example.com/slide${i + 1}.png`,
      }));

      expect(() => {
        builder.buildPayload({
          templateId: 'template-123',
          slides,
          title: 'Test',
          caption: false,
        });
      }).toThrow('cannot contain more than 10 slides');
    });

    it('should reject missing templateId', () => {
      const slides = [
        {
          index: 1,
          speakerText: 'First slide',
          imageUrl: 'https://example.com/slide1.png',
        },
      ];

      expect(() => {
        builder.buildPayload({
          templateId: '', // Empty
          slides,
          title: 'Test',
          caption: false,
        });
      }).toThrow('templateId is required');
    });

    it('should reject invalid caption type', () => {
      const slides = [
        {
          index: 1,
          speakerText: 'First slide',
          imageUrl: 'https://example.com/slide1.png',
        },
      ];

      expect(() => {
        builder.buildPayload({
          templateId: 'template-123',
          slides,
          title: 'Test',
          caption: 'true', // String instead of boolean
        });
      }).toThrow('caption must be a boolean');
    });

    it('should reject invalid voiceId type', () => {
      const slides = [
        {
          index: 1,
          speakerText: 'First slide',
          imageUrl: 'https://example.com/slide1.png',
        },
      ];

      expect(() => {
        builder.buildPayload({
          templateId: 'template-123',
          slides,
          title: 'Test',
          caption: false,
          voiceId: 123, // Number instead of string
        });
      }).toThrow('voiceId must be a string');
    });
  });

  describe('buildPayload - Optional Parameters', () => {
    it('should include voiceId if provided', () => {
      const slides = [
        {
          index: 1,
          speakerText: 'First slide',
          imageUrl: 'https://example.com/slide1.png',
        },
      ];

      const payload = builder.buildPayload({
        templateId: 'template-123',
        slides,
        title: 'Test',
        caption: false,
        voiceId: 'voice-123',
      });

      expect(payload).toHaveProperty('voice_id', 'voice-123');
    });

    it('should not include voiceId if not provided', () => {
      const slides = [
        {
          index: 1,
          speakerText: 'First slide',
          imageUrl: 'https://example.com/slide1.png',
        },
      ];

      const payload = builder.buildPayload({
        templateId: 'template-123',
        slides,
        title: 'Test',
        caption: false,
      });

      expect(payload).not.toHaveProperty('voice_id');
    });

    it('should include caption_settings only if caption is true', () => {
      const slides = [
        {
          index: 1,
          speakerText: 'First slide',
          imageUrl: 'https://example.com/slide1.png',
        },
      ];

      const payloadWithCaption = builder.buildPayload({
        templateId: 'template-123',
        slides,
        title: 'Test',
        caption: true,
      });

      expect(payloadWithCaption).toHaveProperty('caption_settings');
      expect(payloadWithCaption.caption_settings.enabled).toBe(true);

      const payloadWithoutCaption = builder.buildPayload({
        templateId: 'template-123',
        slides,
        title: 'Test',
        caption: false,
      });

      expect(payloadWithoutCaption).not.toHaveProperty('caption_settings');
    });

    it('should use default title if not provided', () => {
      const slides = [
        {
          index: 1,
          speakerText: 'First slide',
          imageUrl: 'https://example.com/slide1.png',
        },
      ];

      const payload = builder.buildPayload({
        templateId: 'template-123',
        slides,
        caption: false,
      });

      expect(payload).toHaveProperty('title', 'EduCore Presentation');
    });
  });

  describe('buildPayload - Text Trimming', () => {
    it('should trim whitespace from speakerText', () => {
      const slides = [
        {
          index: 1,
          speakerText: '  Trimmed text  ',
          imageUrl: 'https://example.com/slide1.png',
        },
      ];

      const payload = builder.buildPayload({
        templateId: 'template-123',
        slides,
        title: 'Test',
        caption: false,
      });

      expect(payload.variables.speech_1).toBe('Trimmed text');
    });

    it('should trim whitespace from imageUrl', () => {
      const slides = [
        {
          index: 1,
          speakerText: 'First slide',
          imageUrl: '  https://example.com/slide1.png  ',
        },
      ];

      const payload = builder.buildPayload({
        templateId: 'template-123',
        slides,
        title: 'Test',
        caption: false,
      });

      expect(payload.variables.image_1).toEqual({ image: { name: 'slide1', url: 'https://example.com/slide1.png' } });
    });
  });

  describe('buildPayload - Edge Cases', () => {
    it('should handle single slide', () => {
      const slides = [
        {
          index: 1,
          speakerText: 'Single slide',
          imageUrl: 'https://example.com/slide1.png',
        },
      ];

      const payload = builder.buildPayload({
        templateId: 'template-123',
        slides,
        title: 'Test',
        caption: false,
      });

      expect(Object.keys(payload.variables)).toEqual(['image_1', 'speech_1']);
      expect(payload.variables.image_1).toEqual({ image: { name: 'slide1', url: 'https://example.com/slide1.png' } });
      expect(payload.variables.speech_1).toBe('Single slide');
    });

    it('should handle all 10 slides', () => {
      const slides = Array.from({ length: 10 }, (_, i) => ({
        index: i + 1,
        speakerText: `Slide ${i + 1} narration`,
        imageUrl: `https://example.com/slide${i + 1}.png`,
      }));

      const payload = builder.buildPayload({
        templateId: 'template-123',
        slides,
        title: 'Test',
        caption: false,
      });

      expect(Object.keys(payload.variables)).toHaveLength(20); // 10 images + 10 speeches
      expect(payload.variables.image_10).toEqual({ image: { name: 'slide10', url: 'https://example.com/slide10.png' } });
      expect(payload.variables.speech_10).toBe('Slide 10 narration');
    });

    it('should handle slides with special characters in text', () => {
      const slides = [
        {
          index: 1,
          speakerText: 'Text with "quotes" and (parentheses)',
          imageUrl: 'https://example.com/slide1.png',
        },
      ];

      const payload = builder.buildPayload({
        templateId: 'template-123',
        slides,
        title: 'Test',
        caption: false,
      });

      expect(payload.variables.speech_1).toBe('Text with "quotes" and (parentheses)');
    });

    it('should handle Hebrew text', () => {
      const slides = [
        {
          index: 1,
          speakerText: 'זהו שקף ראשון בעברית',
          imageUrl: 'https://example.com/slide1.png',
        },
      ];

      const payload = builder.buildPayload({
        templateId: 'template-123',
        slides,
        title: 'Test',
        caption: false,
      });

      expect(payload.variables.speech_1).toBe('זהו שקף ראשון בעברית');
    });
  });
});

