/**
 * Test suite for SlideSpeechBuilder
 * Tests speaker text building with Hebrew and English examples
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SlideSpeechBuilder } from '../../../src/services/SlideSpeechBuilder.js';

describe('SlideSpeechBuilder', () => {
  let builder;

  beforeEach(() => {
    builder = new SlideSpeechBuilder(10);
  });

  describe('Constructor', () => {
    it('should create SlideSpeechBuilder with default maxSlides', () => {
      const defaultBuilder = new SlideSpeechBuilder();
      expect(defaultBuilder).toBeInstanceOf(SlideSpeechBuilder);
      expect(defaultBuilder.maxSlides).toBe(10);
    });

    it('should create SlideSpeechBuilder with custom maxSlides', () => {
      const customBuilder = new SlideSpeechBuilder(5);
      expect(customBuilder.maxSlides).toBe(5);
    });

    it('should throw error if maxSlides is invalid', () => {
      expect(() => new SlideSpeechBuilder(0)).toThrow('maxSlides must be between 1 and 10');
      expect(() => new SlideSpeechBuilder(11)).toThrow('maxSlides must be between 1 and 10');
    });
  });

  describe('buildSpeakerText - String Input', () => {
    it('should build speaker text from string array (English)', () => {
      const explanations = [
        'Welcome to our presentation about React components.',
        'Today we will learn about functional components.',
        'Functional components are simpler than class components.',
      ];

      const result = builder.buildSpeakerText(explanations);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        index: 1,
        speakerText: 'Welcome to our presentation about React components.',
      });
      expect(result[1]).toEqual({
        index: 2,
        speakerText: 'Today we will learn about functional components.',
      });
      expect(result[2]).toEqual({
        index: 3,
        speakerText: 'Functional components are simpler than class components.',
      });
    });

    it('should build speaker text from string array (Hebrew)', () => {
      const explanations = [
        'ברוכים הבאים למצגת שלנו על רכיבי React.',
        'היום נלמד על רכיבים פונקציונליים.',
        'רכיבים פונקציונליים פשוטים יותר מרכיבי מחלקה.',
      ];

      const result = builder.buildSpeakerText(explanations);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        index: 1,
        speakerText: 'ברוכים הבאים למצגת שלנו על רכיבי React.',
      });
      expect(result[1]).toEqual({
        index: 2,
        speakerText: 'היום נלמד על רכיבים פונקציונליים.',
      });
      expect(result[2]).toEqual({
        index: 3,
        speakerText: 'רכיבים פונקציונליים פשוטים יותר מרכיבי מחלקה.',
      });
    });

    it('should handle mixed language input', () => {
      const explanations = [
        'Welcome to our presentation.',
        'ברוכים הבאים למצגת שלנו.',
        'Today we will learn about React.',
      ];

      const result = builder.buildSpeakerText(explanations);

      expect(result).toHaveLength(3);
      expect(result[0].speakerText).toBe('Welcome to our presentation.');
      expect(result[1].speakerText).toBe('ברוכים הבאים למצגת שלנו.');
      expect(result[2].speakerText).toBe('Today we will learn about React.');
    });
  });

  describe('buildSpeakerText - Object Input', () => {
    it('should extract text from objects with speakerText property', () => {
      const explanations = [
        { speakerText: 'First slide explanation' },
        { speakerText: 'Second slide explanation' },
      ];

      const result = builder.buildSpeakerText(explanations);

      expect(result).toHaveLength(2);
      expect(result[0].speakerText).toBe('First slide explanation');
      expect(result[1].speakerText).toBe('Second slide explanation');
    });

    it('should extract text from objects with narration property', () => {
      const explanations = [
        { index: 1, narration: 'This is the first slide narration.' },
        { index: 2, narration: 'This is the second slide narration.' },
      ];

      const result = builder.buildSpeakerText(explanations);

      expect(result).toHaveLength(2);
      expect(result[0].speakerText).toBe('This is the first slide narration.');
      expect(result[1].speakerText).toBe('This is the second slide narration.');
    });

    it('should extract text from objects with text property', () => {
      const explanations = [
        { text: 'First slide text' },
        { text: 'Second slide text' },
      ];

      const result = builder.buildSpeakerText(explanations);

      expect(result).toHaveLength(2);
      expect(result[0].speakerText).toBe('First slide text');
      expect(result[1].speakerText).toBe('Second slide text');
    });

    it('should extract text from objects with content property (Hebrew)', () => {
      const explanations = [
        { content: 'זהו השקף הראשון.' },
        { content: 'זהו השקף השני.' },
      ];

      const result = builder.buildSpeakerText(explanations);

      expect(result).toHaveLength(2);
      expect(result[0].speakerText).toBe('זהו השקף הראשון.');
      expect(result[1].speakerText).toBe('זהו השקף השני.');
    });

    it('should handle OpenAI-style response objects', () => {
      const explanations = [
        { answer: 'This is the OpenAI response for slide 1.' },
        { answer: 'This is the OpenAI response for slide 2.' },
      ];

      const result = builder.buildSpeakerText(explanations);

      expect(result).toHaveLength(2);
      expect(result[0].speakerText).toBe('This is the OpenAI response for slide 1.');
      expect(result[1].speakerText).toBe('This is the OpenAI response for slide 2.');
    });
  });

  describe('buildSpeakerText - Validation', () => {
    it('should throw error if input is not an array', () => {
      expect(() => builder.buildSpeakerText(null)).toThrow('aiSlideExplanations must be an array');
      expect(() => builder.buildSpeakerText({})).toThrow('aiSlideExplanations must be an array');
      expect(() => builder.buildSpeakerText('string')).toThrow('aiSlideExplanations must be an array');
    });

    it('should throw error if input array is empty', () => {
      expect(() => builder.buildSpeakerText([])).toThrow('aiSlideExplanations cannot be empty');
    });

    it('should throw error if speaker text is empty string', () => {
      const explanations = ['Valid text', '', 'Another valid text'];
      expect(() => builder.buildSpeakerText(explanations)).toThrow('cannot be empty');
    });

    it('should throw error if speaker text is only whitespace', () => {
      const explanations = ['Valid text', '   \n\t  ', 'Another valid text'];
      expect(() => builder.buildSpeakerText(explanations)).toThrow('cannot be empty');
    });

    it('should throw error if speaker text is null or undefined', () => {
      const explanations1 = ['Valid text', null, 'Another valid text'];
      expect(() => builder.buildSpeakerText(explanations1)).toThrow('is null or undefined');

      const explanations2 = ['Valid text', undefined, 'Another valid text'];
      expect(() => builder.buildSpeakerText(explanations2)).toThrow('is null or undefined');
    });

    it('should throw error if object has no extractable text property', () => {
      const explanations = [
        { speakerText: 'Valid text' },
        { someOtherProperty: 'value' }, // No text property
      ];

      expect(() => builder.buildSpeakerText(explanations)).toThrow('Cannot extract text from object');
    });
  });

  describe('buildSpeakerText - Whitespace Trimming', () => {
    it('should trim leading and trailing whitespace', () => {
      const explanations = [
        '  Text with leading spaces  ',
        '\tText with tabs\t',
        '\nText with newlines\n',
      ];

      const result = builder.buildSpeakerText(explanations);

      expect(result[0].speakerText).toBe('Text with leading spaces');
      expect(result[1].speakerText).toBe('Text with tabs');
      expect(result[2].speakerText).toBe('Text with newlines');
    });

    it('should collapse multiple whitespace to single space', () => {
      const explanations = [
        'Text   with    multiple     spaces',
        'Text\n\nwith\n\nnewlines',
        'Text\t\twith\t\ttabs',
        'Text   \n\n  with   \t\t  mixed   whitespace',
      ];

      const result = builder.buildSpeakerText(explanations);

      expect(result[0].speakerText).toBe('Text with multiple spaces');
      expect(result[1].speakerText).toBe('Text with newlines');
      expect(result[2].speakerText).toBe('Text with tabs');
      expect(result[3].speakerText).toBe('Text with mixed whitespace');
    });

    it('should preserve single spaces between words (Hebrew)', () => {
      const explanations = [
        '  זהו טקסט בעברית עם רווחים  ',
        'זהו   טקסט   עם   רווחים   מרובים',
      ];

      const result = builder.buildSpeakerText(explanations);

      expect(result[0].speakerText).toBe('זהו טקסט בעברית עם רווחים');
      expect(result[1].speakerText).toBe('זהו טקסט עם רווחים מרובים');
    });
  });

  describe('buildSpeakerText - Max Slides Limit', () => {
    it('should truncate if more explanations than maxSlides', () => {
      const explanations = Array.from({ length: 15 }, (_, i) => `Slide ${i + 1} explanation`);
      const result = builder.buildSpeakerText(explanations);

      expect(result).toHaveLength(10); // Default maxSlides is 10
      expect(result[9].index).toBe(10);
    });

    it('should respect custom maxSlides', () => {
      const customBuilder = new SlideSpeechBuilder(5);
      const explanations = Array.from({ length: 10 }, (_, i) => `Slide ${i + 1} explanation`);
      const result = customBuilder.buildSpeakerText(explanations);

      expect(result).toHaveLength(5);
      expect(result[4].index).toBe(5);
    });

    it('should handle exactly maxSlides', () => {
      const explanations = Array.from({ length: 10 }, (_, i) => `Slide ${i + 1} explanation`);
      const result = builder.buildSpeakerText(explanations);

      expect(result).toHaveLength(10);
      expect(result[9].index).toBe(10);
    });
  });

  describe('buildSpeakerText - Index Assignment', () => {
    it('should assign sequential indices starting from 1', () => {
      const explanations = [
        'First slide',
        'Second slide',
        'Third slide',
      ];

      const result = builder.buildSpeakerText(explanations);

      expect(result.map(r => r.index)).toEqual([1, 2, 3]);
    });

    it('should assign correct indices for Hebrew slides', () => {
      const explanations = [
        'שקף ראשון',
        'שקף שני',
        'שקף שלישי',
      ];

      const result = builder.buildSpeakerText(explanations);

      expect(result.map(r => r.index)).toEqual([1, 2, 3]);
      expect(result[0].speakerText).toBe('שקף ראשון');
      expect(result[1].speakerText).toBe('שקף שני');
      expect(result[2].speakerText).toBe('שקף שלישי');
    });
  });

  describe('buildFromStructured', () => {
    it('should build from structured format with slides array', () => {
      const structuredData = {
        slides: [
          { index: 1, narration: 'First slide narration' },
          { index: 2, narration: 'Second slide narration' },
        ],
      };

      const result = builder.buildFromStructured(structuredData);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        index: 1,
        speakerText: 'First slide narration',
      });
      expect(result[1]).toEqual({
        index: 2,
        speakerText: 'Second slide narration',
      });
    });

    it('should build from structured format with speakerText property', () => {
      const structuredData = {
        slides: [
          { index: 1, speakerText: 'First slide text' },
          { index: 2, speakerText: 'Second slide text' },
        ],
      };

      const result = builder.buildFromStructured(structuredData);

      expect(result).toHaveLength(2);
      expect(result[0].speakerText).toBe('First slide text');
      expect(result[1].speakerText).toBe('Second slide text');
    });

    it('should build from structured format (Hebrew)', () => {
      const structuredData = {
        slides: [
          { index: 1, narration: 'זהו השקף הראשון' },
          { index: 2, narration: 'זהו השקף השני' },
        ],
      };

      const result = builder.buildFromStructured(structuredData);

      expect(result).toHaveLength(2);
      expect(result[0].speakerText).toBe('זהו השקף הראשון');
      expect(result[1].speakerText).toBe('זהו השקף השני');
    });

    it('should throw error if structuredData is invalid', () => {
      expect(() => builder.buildFromStructured(null)).toThrow('structuredData must be an object');
      expect(() => builder.buildFromStructured({})).toThrow('structuredData must have a slides array');
      expect(() => builder.buildFromStructured({ slides: 'not-array' })).toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle single slide', () => {
      const explanations = ['Single slide explanation'];
      const result = builder.buildSpeakerText(explanations);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        index: 1,
        speakerText: 'Single slide explanation',
      });
    });

    it('should handle very long text (English)', () => {
      const longText = 'This is a very long explanation. '.repeat(100);
      const explanations = [longText];
      const result = builder.buildSpeakerText(explanations);

      expect(result[0].speakerText).toBe(longText.trim());
    });

    it('should handle very long text (Hebrew)', () => {
      const longText = 'זהו הסבר ארוך מאוד. '.repeat(100);
      const explanations = [longText];
      const result = builder.buildSpeakerText(explanations);

      expect(result[0].speakerText).toBe(longText.trim());
    });

    it('should preserve special characters', () => {
      const explanations = [
        'Text with "quotes" and (parentheses)',
        'Text with numbers: 123, 456, 789',
        'Text with symbols: @#$%^&*()',
      ];

      const result = builder.buildSpeakerText(explanations);

      expect(result[0].speakerText).toBe('Text with "quotes" and (parentheses)');
      expect(result[1].speakerText).toBe('Text with numbers: 123, 456, 789');
      expect(result[2].speakerText).toBe('Text with symbols: @#$%^&*()');
    });

    it('should preserve Hebrew punctuation', () => {
      const explanations = [
        'טקסט עם נקודה.',
        'טקסט עם פסיק, וסימן שאלה?',
        'טקסט עם נקודתיים: וסימן קריאה!',
      ];

      const result = builder.buildSpeakerText(explanations);

      expect(result[0].speakerText).toBe('טקסט עם נקודה.');
      expect(result[1].speakerText).toBe('טקסט עם פסיק, וסימן שאלה?');
      expect(result[2].speakerText).toBe('טקסט עם נקודתיים: וסימן קריאה!');
    });
  });
});

