import { logger } from '../../infrastructure/logging/Logger.js';
import { EMPTY_PAGE_NARRATION, isEmptyPageText } from './emptyPageNarration.js';

const LANGUAGE_NAMES = {
  he: 'Hebrew',
  en: 'English',
  ar: 'Arabic',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ru: 'Russian',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
};

/**
 * Generate narrations for all slides in ONE structured OpenAI call.
 * Does NOT compress to a 30-second global script.
 * Does NOT use per-slide LLM calls on the normal success path.
 */
export class SlideNarrationGenerator {
  /**
   * @param {{ openaiClient: { generateText: Function }, maxRetries?: number }} deps
   */
  constructor({ openaiClient, maxRetries = 1 }) {
    if (!openaiClient || typeof openaiClient.generateText !== 'function') {
      throw new Error('openaiClient with generateText is required');
    }
    this.openaiClient = openaiClient;
    this.maxRetries = maxRetries;
  }

  /**
   * @param {{ language: string, topicName?: string, slides: Array<{ pageNumber: number, text: string }> }} input
   * @returns {Promise<Array<{ pageNumber: number, narration: string }>>}
   */
  async generateNarrations({ language, topicName = 'lesson', slides }) {
    if (!Array.isArray(slides) || slides.length === 0) {
      throw new Error('slides must be a non-empty array');
    }

    const expectedPageNumbers = slides.map((s) => s.pageNumber).sort((a, b) => a - b);
    assertUniqueSortedPages(expectedPageNumbers);

    const languageName = LANGUAGE_NAMES[language] || language || 'English';
    const prompt = buildNarrationPrompt({
      languageName,
      topicName,
      slides,
    });

    let lastError = null;
    const attempts = this.maxRetries + 1;

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const raw = await this.openaiClient.generateText(prompt, {
          model: 'gpt-4o',
          temperature: 0.4,
          max_tokens: Math.max(1500, slides.length * 180),
          systemPrompt:
            'You are an educational narration writer. Return ONLY valid JSON. No markdown fences.',
        });

        const parsed = parseNarrationJson(raw);
        const validated = validateNarrationSlides(parsed, expectedPageNumbers);
        return applyEmptyPageFallback(validated, slides);
      } catch (error) {
        lastError = error;
        logger.warn('[SlideNarrationGenerator] Structured narration attempt failed', {
          attempt: attempt + 1,
          attempts,
          error: error.message,
        });
      }
    }

    throw new Error(
      `Failed to generate structured slide narrations after ${attempts} attempt(s): ${lastError?.message}`
    );
  }
}

/**
 * @param {{ languageName: string, topicName: string, slides: Array<{ pageNumber: number, text: string }> }} params
 */
export function buildNarrationPrompt({ languageName, topicName, slides }) {
  const slideBlocks = slides
    .map(
      (slide) =>
        `Page ${slide.pageNumber}:\n${isEmptyPageText(slide.text) ? '[NO EXTRACTABLE TEXT]' : slide.text}`
    )
    .join('\n\n---\n\n');

  return `Create spoken educational narrations for every presentation page below.

Topic: ${topicName}
Language: ${languageName}

Requirements:
- Return ONE narration per page for EXACTLY these page numbers: ${slides.map((s) => s.pageNumber).join(', ')}
- Explain each page naturally to a learner; do not merely read bullet points mechanically
- Stay grounded in the extracted page text; do not invent unsupported facts
- Do not invent visual meaning for charts/images when text is missing
- Do not mention "Slide 1", "Slide 2", or page numbers in the spoken narration
- Avoid repeating the same introduction or conclusion on every page
- Keep each narration concise and suitable for spoken delivery
- Do NOT produce a single global 30-second script

Return ONLY valid JSON in this exact shape:
{
  "slides": [
    { "pageNumber": 1, "narration": "..." },
    { "pageNumber": 2, "narration": "..." }
  ]
}

Page content:
${slideBlocks}`;
}

/**
 * @param {string} raw
 * @returns {{ slides: Array<{ pageNumber: number, narration: string }> }}
 */
export function parseNarrationJson(raw) {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Narration response is empty');
  }

  const cleaned = raw.trim();
  const jsonMatch =
    cleaned.match(/```json\s*([\s\S]*?)\s*```/) ||
    cleaned.match(/```\s*([\s\S]*?)\s*```/) ||
    cleaned.match(/\{[\s\S]*\}/);

  const jsonText = jsonMatch ? jsonMatch[1] || jsonMatch[0] : cleaned;

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`Narration response is not valid JSON: ${error.message}`);
  }

  if (!parsed || !Array.isArray(parsed.slides)) {
    throw new Error('Narration JSON must contain a slides array');
  }

  return parsed;
}

/**
 * @param {{ slides: Array<{ pageNumber: number, narration: string }> }} parsed
 * @param {number[]} expectedPageNumbers
 */
export function validateNarrationSlides(parsed, expectedPageNumbers) {
  const slides = parsed.slides;
  if (slides.length !== expectedPageNumbers.length) {
    throw new Error(
      `Narration slide count mismatch: expected ${expectedPageNumbers.length}, got ${slides.length}`
    );
  }

  const byPage = new Map();
  for (const slide of slides) {
    if (!Number.isInteger(slide.pageNumber) || slide.pageNumber < 1) {
      throw new Error(`Invalid narration pageNumber: ${slide.pageNumber}`);
    }
    if (typeof slide.narration !== 'string') {
      throw new Error(`Narration for page ${slide.pageNumber} must be a string`);
    }
    if (byPage.has(slide.pageNumber)) {
      throw new Error(`Duplicate narration pageNumber: ${slide.pageNumber}`);
    }
    byPage.set(slide.pageNumber, slide.narration.trim());
  }

  for (const pageNumber of byPage.keys()) {
    if (!expectedPageNumbers.includes(pageNumber)) {
      throw new Error(`Unknown narration pageNumber: ${pageNumber}`);
    }
  }

  for (const pageNumber of expectedPageNumbers) {
    if (!byPage.has(pageNumber)) {
      throw new Error(`Missing narration for pageNumber ${pageNumber}`);
    }
  }

  return expectedPageNumbers.map((pageNumber) => ({
    pageNumber,
    narration: byPage.get(pageNumber),
  }));
}

/**
 * Replace empty-source narrations with the centralized empty-page fallback when needed.
 * If the model already returned a non-empty string for an empty page, keep it only if non-empty;
 * otherwise apply EMPTY_PAGE_NARRATION.
 *
 * @param {Array<{ pageNumber: number, narration: string }>} narrations
 * @param {Array<{ pageNumber: number, text: string }>} sourceSlides
 */
export function applyEmptyPageFallback(narrations, sourceSlides) {
  const textByPage = new Map(sourceSlides.map((s) => [s.pageNumber, s.text]));
  return narrations.map((item) => {
    const sourceText = textByPage.get(item.pageNumber) ?? '';
    if (isEmptyPageText(sourceText) && isEmptyPageText(item.narration)) {
      return { ...item, narration: EMPTY_PAGE_NARRATION };
    }
    if (isEmptyPageText(item.narration)) {
      throw new Error(`Empty narration for pageNumber ${item.pageNumber}`);
    }
    return item;
  });
}

function assertUniqueSortedPages(pageNumbers) {
  const seen = new Set();
  for (const pageNumber of pageNumbers) {
    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      throw new Error(`Invalid expected pageNumber: ${pageNumber}`);
    }
    if (seen.has(pageNumber)) {
      throw new Error(`Duplicate expected pageNumber: ${pageNumber}`);
    }
    seen.add(pageNumber);
  }
}
