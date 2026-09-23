import { describe, it, expect, jest } from '@jest/globals';
import {
  SlideNarrationGenerator,
  parseNarrationJson,
  validateNarrationSlides,
  applyEmptyPageFallback,
  buildNarrationPrompt,
} from '../../../../src/services/narration-bundle/SlideNarrationGenerator.js';
import { EMPTY_PAGE_NARRATION } from '../../../../src/services/narration-bundle/emptyPageNarration.js';

describe('SlideNarrationGenerator helpers', () => {
  it('parses raw JSON', () => {
    const parsed = parseNarrationJson(
      JSON.stringify({
        slides: [{ pageNumber: 1, narration: 'Hello' }],
      })
    );
    expect(parsed.slides).toHaveLength(1);
  });

  it('parses JSON inside markdown fences', () => {
    const parsed = parseNarrationJson(
      '```json\n{"slides":[{"pageNumber":1,"narration":"Hi"}]}\n```'
    );
    expect(parsed.slides[0].narration).toBe('Hi');
  });

  it('rejects malformed JSON', () => {
    expect(() => parseNarrationJson('{not-json')).toThrow(/not valid JSON/);
  });

  it('validates exact page coverage', () => {
    const result = validateNarrationSlides(
      {
        slides: [
          { pageNumber: 2, narration: 'B' },
          { pageNumber: 1, narration: 'A' },
        ],
      },
      [1, 2]
    );
    expect(result).toEqual([
      { pageNumber: 1, narration: 'A' },
      { pageNumber: 2, narration: 'B' },
    ]);
  });

  it('rejects missing page', () => {
    expect(() =>
      validateNarrationSlides(
        { slides: [{ pageNumber: 1, narration: 'A' }] },
        [1, 2]
      )
    ).toThrow(/slide count mismatch/i);
  });

  it('rejects duplicate page', () => {
    expect(() =>
      validateNarrationSlides(
        {
          slides: [
            { pageNumber: 1, narration: 'A' },
            { pageNumber: 1, narration: 'B' },
          ],
        },
        [1, 2]
      )
    ).toThrow(/Duplicate narration pageNumber/);
  });

  it('rejects unknown page', () => {
    expect(() =>
      validateNarrationSlides(
        {
          slides: [
            { pageNumber: 1, narration: 'A' },
            { pageNumber: 9, narration: 'Z' },
          ],
        },
        [1, 2]
      )
    ).toThrow(/Unknown narration pageNumber/);
  });

  it('applies empty-page fallback when source text and narration are empty', () => {
    const result = applyEmptyPageFallback(
      [{ pageNumber: 1, narration: '' }],
      [{ pageNumber: 1, text: '' }]
    );
    expect(result[0].narration).toBe(EMPTY_PAGE_NARRATION);
  });

  it('includes all pages in prompt and forbids 30-second script', () => {
    const prompt = buildNarrationPrompt({
      languageName: 'English',
      topicName: 'Loops',
      slides: [
        { pageNumber: 1, text: 'For loops' },
        { pageNumber: 2, text: '' },
      ],
    });
    expect(prompt).toContain('Page 1:');
    expect(prompt).toContain('Page 2:');
    expect(prompt).toContain('[NO EXTRACTABLE TEXT]');
    expect(prompt).toContain('Do NOT produce a single global 30-second script');
  });
});

describe('SlideNarrationGenerator', () => {
  it('uses ONE generateText call on success', async () => {
    const generateText = jest.fn().mockResolvedValue(
      JSON.stringify({
        slides: [
          { pageNumber: 1, narration: 'First narration' },
          { pageNumber: 2, narration: 'Second narration' },
        ],
      })
    );

    const generator = new SlideNarrationGenerator({ openaiClient: { generateText } });
    const result = await generator.generateNarrations({
      language: 'en',
      topicName: 'Topic',
      slides: [
        { pageNumber: 1, text: 'A' },
        { pageNumber: 2, text: 'B' },
      ],
    });

    expect(generateText).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      { pageNumber: 1, narration: 'First narration' },
      { pageNumber: 2, narration: 'Second narration' },
    ]);
  });

  it('retries once on malformed JSON then fails', async () => {
    const generateText = jest
      .fn()
      .mockResolvedValueOnce('not-json')
      .mockResolvedValueOnce('still-bad');

    const generator = new SlideNarrationGenerator({
      openaiClient: { generateText },
      maxRetries: 1,
    });

    await expect(
      generator.generateNarrations({
        language: 'en',
        slides: [{ pageNumber: 1, text: 'A' }],
      })
    ).rejects.toThrow(/Failed to generate structured slide narrations/);

    expect(generateText).toHaveBeenCalledTimes(2);
  });
});
