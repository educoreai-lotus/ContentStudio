/**
 * Deterministic narration used when a PDF page has no extractable text.
 * Phase 1 does not use vision/OCR beyond pdf-parse text extraction.
 */
export const EMPTY_PAGE_NARRATION =
  'This page has limited readable text. Continue with the lesson using the surrounding slides.';

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isEmptyPageText(text) {
  return !text || typeof text !== 'string' || text.trim().length === 0;
}
