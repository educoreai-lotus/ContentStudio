/**
 * Test suite for SlidePlan domain model
 * Validates slide plan structure, limits, and validation rules
 */

import { describe, it, expect } from '@jest/globals';
import { SlidePlan } from '../../../../src/domain/slides/SlidePlan.js';

describe('SlidePlan', () => {
  describe('Constructor and Validation', () => {
    it('should create SlidePlan with valid slides', () => {
      const slides = [
        {
          index: 1,
          title: 'Introduction',
          speakerText: 'Welcome to the presentation',
          imageUrl: 'https://example.com/slide1.jpg',
        },
        {
          index: 2,
          speakerText: 'This is slide 2',
          imageUrl: 'https://example.com/slide2.jpg',
        },
      ];

      const plan = new SlidePlan(slides);
      expect(plan.slideCount).toBe(2);
      expect(plan.getAllSlides()).toHaveLength(2);
    });

    it('should throw error if slides is not an array', () => {
      expect(() => new SlidePlan(null)).toThrow('Slides must be an array');
      expect(() => new SlidePlan({})).toThrow('Slides must be an array');
      expect(() => new SlidePlan('invalid')).toThrow('Slides must be an array');
    });

    it('should throw error if slides array is empty', () => {
      expect(() => new SlidePlan([])).toThrow('SlidePlan must contain at least 1 slide');
    });

    it('should throw error if more than 10 slides', () => {
      const slides = Array.from({ length: 11 }, (_, i) => ({
        index: i + 1,
        speakerText: `Slide ${i + 1}`,
        imageUrl: `https://example.com/slide${i + 1}.jpg`,
      }));

      expect(() => new SlidePlan(slides)).toThrow('SlidePlan cannot contain more than 10 slides');
    });

    it('should accept exactly 10 slides', () => {
      const slides = Array.from({ length: 10 }, (_, i) => ({
        index: i + 1,
        speakerText: `Slide ${i + 1}`,
        imageUrl: `https://example.com/slide${i + 1}.jpg`,
      }));

      const plan = new SlidePlan(slides);
      expect(plan.slideCount).toBe(10);
    });
  });

  describe('Index Validation', () => {
    it('should throw error if index is less than 1', () => {
      const slides = [
        {
          index: 0,
          speakerText: 'Invalid slide',
          imageUrl: 'https://example.com/slide.jpg',
        },
      ];

      expect(() => new SlidePlan(slides)).toThrow('Slide index must be between 1 and 10');
    });

    it('should throw error if index is greater than 10', () => {
      const slides = [
        {
          index: 11,
          speakerText: 'Invalid slide',
          imageUrl: 'https://example.com/slide.jpg',
        },
      ];

      expect(() => new SlidePlan(slides)).toThrow('Slide index must be between 1 and 10');
    });

    it('should throw error if index is not an integer', () => {
      const slides = [
        {
          index: 1.5,
          speakerText: 'Invalid slide',
          imageUrl: 'https://example.com/slide.jpg',
        },
      ];

      expect(() => new SlidePlan(slides)).toThrow('must have a valid integer index');
    });

    it('should throw error if indices are not sequential (1..N)', () => {
      const slides = [
        {
          index: 1,
          speakerText: 'Slide 1',
          imageUrl: 'https://example.com/slide1.jpg',
        },
        {
          index: 3, // Missing index 2
          speakerText: 'Slide 3',
          imageUrl: 'https://example.com/slide3.jpg',
        },
      ];

      expect(() => new SlidePlan(slides)).toThrow('Slide indices must be sequential starting from 1');
    });

    it('should throw error if duplicate indices exist', () => {
      const slides = [
        {
          index: 1,
          speakerText: 'Slide 1',
          imageUrl: 'https://example.com/slide1.jpg',
        },
        {
          index: 1, // Duplicate
          speakerText: 'Slide 1 duplicate',
          imageUrl: 'https://example.com/slide1-dup.jpg',
        },
      ];

      expect(() => new SlidePlan(slides)).toThrow('Duplicate slide index: 1');
    });

    it('should accept sequential indices 1..N', () => {
      const slides = [
        {
          index: 1,
          speakerText: 'Slide 1',
          imageUrl: 'https://example.com/slide1.jpg',
        },
        {
          index: 2,
          speakerText: 'Slide 2',
          imageUrl: 'https://example.com/slide2.jpg',
        },
        {
          index: 3,
          speakerText: 'Slide 3',
          imageUrl: 'https://example.com/slide3.jpg',
        },
      ];

      const plan = new SlidePlan(slides);
      expect(plan.slideCount).toBe(3);
    });
  });

  describe('Required Fields Validation', () => {
    it('should throw error if speakerText is missing', () => {
      const slides = [
        {
          index: 1,
          imageUrl: 'https://example.com/slide1.jpg',
        },
      ];

      expect(() => new SlidePlan(slides)).toThrow('must have a non-empty speakerText');
    });

    it('should throw error if speakerText is empty string', () => {
      const slides = [
        {
          index: 1,
          speakerText: '',
          imageUrl: 'https://example.com/slide1.jpg',
        },
      ];

      expect(() => new SlidePlan(slides)).toThrow('must have a non-empty speakerText');
    });

    it('should throw error if speakerText is only whitespace', () => {
      const slides = [
        {
          index: 1,
          speakerText: '   ',
          imageUrl: 'https://example.com/slide1.jpg',
        },
      ];

      expect(() => new SlidePlan(slides)).toThrow('must have a non-empty speakerText');
    });

    it('should throw error if imageUrl is missing', () => {
      const slides = [
        {
          index: 1,
          speakerText: 'Slide text',
        },
      ];

      expect(() => new SlidePlan(slides)).toThrow('must have a non-empty imageUrl');
    });

    it('should throw error if imageUrl is empty string', () => {
      const slides = [
        {
          index: 1,
          speakerText: 'Slide text',
          imageUrl: '',
        },
      ];

      expect(() => new SlidePlan(slides)).toThrow('must have a non-empty imageUrl');
    });

    it('should throw error if imageUrl is not a valid URL', () => {
      const slides = [
        {
          index: 1,
          speakerText: 'Slide text',
          imageUrl: 'not-a-valid-url',
        },
      ];

      expect(() => new SlidePlan(slides)).toThrow('must have a valid URL for imageUrl');
    });

    it('should accept valid URLs for imageUrl', () => {
      const validUrls = [
        'https://example.com/slide.jpg',
        'http://example.com/slide.png',
        'https://storage.example.com/presentations/slide1.jpg',
      ];

      for (const url of validUrls) {
        const slides = [
          {
            index: 1,
            speakerText: 'Slide text',
            imageUrl: url,
          },
        ];

        const plan = new SlidePlan(slides);
        expect(plan.getSlide(1).imageUrl).toBe(url);
      }
    });
  });

  describe('Optional Fields', () => {
    it('should accept slides without title', () => {
      const slides = [
        {
          index: 1,
          speakerText: 'Slide text',
          imageUrl: 'https://example.com/slide1.jpg',
        },
      ];

      const plan = new SlidePlan(slides);
      expect(plan.getSlide(1).title).toBeUndefined();
    });

    it('should accept slides with title', () => {
      const slides = [
        {
          index: 1,
          title: 'Introduction',
          speakerText: 'Slide text',
          imageUrl: 'https://example.com/slide1.jpg',
        },
      ];

      const plan = new SlidePlan(slides);
      expect(plan.getSlide(1).title).toBe('Introduction');
    });

    it('should throw error if title is not a string', () => {
      const slides = [
        {
          index: 1,
          title: 123, // Invalid type
          speakerText: 'Slide text',
          imageUrl: 'https://example.com/slide1.jpg',
        },
      ];

      expect(() => new SlidePlan(slides)).toThrow('title must be a string if provided');
    });
  });

  describe('Methods', () => {
    let plan;

    beforeEach(() => {
      plan = new SlidePlan([
        {
          index: 1,
          title: 'Slide 1',
          speakerText: 'Text for slide 1',
          imageUrl: 'https://example.com/slide1.jpg',
        },
        {
          index: 2,
          speakerText: 'Text for slide 2',
          imageUrl: 'https://example.com/slide2.jpg',
        },
        {
          index: 3,
          title: 'Slide 3',
          speakerText: 'Text for slide 3',
          imageUrl: 'https://example.com/slide3.jpg',
        },
      ]);
    });

    it('should return correct slide count', () => {
      expect(plan.slideCount).toBe(3);
    });

    it('should get slide by index', () => {
      const slide = plan.getSlide(2);
      expect(slide).toBeDefined();
      expect(slide.index).toBe(2);
      expect(slide.speakerText).toBe('Text for slide 2');
    });

    it('should return undefined for non-existent index', () => {
      expect(plan.getSlide(99)).toBeUndefined();
    });

    it('should return all slides sorted by index', () => {
      const allSlides = plan.getAllSlides();
      expect(allSlides).toHaveLength(3);
      expect(allSlides[0].index).toBe(1);
      expect(allSlides[1].index).toBe(2);
      expect(allSlides[2].index).toBe(3);
    });

    it('should convert to JSON', () => {
      const json = plan.toJSON();
      expect(json).toHaveProperty('slides');
      expect(json).toHaveProperty('slideCount', 3);
      expect(json.slides).toHaveLength(3);
      expect(json.slides[0].index).toBe(1);
    });

    it('should create from JSON', () => {
      const json = {
        slides: [
          {
            index: 1,
            speakerText: 'Slide 1',
            imageUrl: 'https://example.com/slide1.jpg',
          },
        ],
      };

      const plan = SlidePlan.fromJSON(json);
      expect(plan.slideCount).toBe(1);
      expect(plan.getSlide(1).speakerText).toBe('Slide 1');
    });

    it('should throw error if JSON is invalid', () => {
      expect(() => SlidePlan.fromJSON(null)).toThrow('Invalid JSON: must contain slides array');
      expect(() => SlidePlan.fromJSON({})).toThrow('Invalid JSON: must contain slides array');
      expect(() => SlidePlan.fromJSON({ slides: null })).toThrow();
    });
  });

  describe('Text Trimming', () => {
    it('should trim whitespace from speakerText', () => {
      const slides = [
        {
          index: 1,
          speakerText: '  Trimmed text  ',
          imageUrl: 'https://example.com/slide1.jpg',
        },
      ];

      const plan = new SlidePlan(slides);
      expect(plan.getSlide(1).speakerText).toBe('Trimmed text');
    });

    it('should trim whitespace from imageUrl', () => {
      const slides = [
        {
          index: 1,
          speakerText: 'Slide text',
          imageUrl: '  https://example.com/slide1.jpg  ',
        },
      ];

      const plan = new SlidePlan(slides);
      expect(plan.getSlide(1).imageUrl).toBe('https://example.com/slide1.jpg');
    });
  });
});

