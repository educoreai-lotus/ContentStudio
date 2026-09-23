/**
 * Align PDF page images with NarrationBundle slides by pageNumber.
 * Strict validation — never silently truncates or aligns by array index alone.
 *
 * @param {Array<{ pageNumber: number, imagePath: string }>} pageImages
 * @param {{
 *   slides: Array<{ pageNumber: number, narration?: string, audioBuffer: Buffer, duration: number }>,
 *   combinedAudioDuration?: number,
 * }} narrationBundle
 * @returns {Array<{
 *   pageNumber: number,
 *   imagePath: string,
 *   narration: string,
 *   audioBuffer: Buffer,
 *   duration: number,
 * }>}
 */
export function alignPresentationWithBundle(pageImages, narrationBundle) {
  if (!Array.isArray(pageImages) || pageImages.length === 0) {
    throw new Error('pageImages must be a non-empty array');
  }
  if (!narrationBundle || !Array.isArray(narrationBundle.slides) || narrationBundle.slides.length === 0) {
    throw new Error('narrationBundle.slides must be a non-empty array');
  }

  const slides = narrationBundle.slides;

  if (pageImages.length !== slides.length) {
    throw new Error(
      `Page count mismatch: ${pageImages.length} image page(s) vs ${slides.length} narration slide(s)`
    );
  }

  assertUniquePageNumbers(pageImages, 'image');
  assertUniquePageNumbers(slides, 'narration');

  const imageByPage = new Map(pageImages.map((p) => [p.pageNumber, p]));
  const slideByPage = new Map(slides.map((s) => [s.pageNumber, s]));

  for (const pageNumber of imageByPage.keys()) {
    if (!slideByPage.has(pageNumber)) {
      throw new Error(`Missing narration slide for pageNumber ${pageNumber}`);
    }
  }
  for (const pageNumber of slideByPage.keys()) {
    if (!imageByPage.has(pageNumber)) {
      throw new Error(`Missing image for pageNumber ${pageNumber}`);
    }
  }

  const orderedPages = [...imageByPage.keys()].sort((a, b) => a - b);

  return orderedPages.map((pageNumber) => {
    const image = imageByPage.get(pageNumber);
    const slide = slideByPage.get(pageNumber);

    if (!Buffer.isBuffer(slide.audioBuffer) || slide.audioBuffer.length === 0) {
      throw new Error(`Missing or empty audioBuffer for pageNumber ${pageNumber}`);
    }
    if (!Number.isFinite(slide.duration) || slide.duration <= 0) {
      throw new Error(`Invalid duration for pageNumber ${pageNumber}: ${slide.duration}`);
    }
    if (!image.imagePath || typeof image.imagePath !== 'string') {
      throw new Error(`Missing imagePath for pageNumber ${pageNumber}`);
    }

    return {
      pageNumber,
      imagePath: image.imagePath,
      narration: typeof slide.narration === 'string' ? slide.narration : '',
      audioBuffer: slide.audioBuffer,
      duration: slide.duration,
    };
  });
}

/**
 * @param {Array<{ pageNumber: number }>} entries
 * @param {string} label
 */
function assertUniquePageNumbers(entries, label) {
  const seen = new Set();
  for (const entry of entries) {
    if (!Number.isInteger(entry.pageNumber) || entry.pageNumber < 1) {
      throw new Error(`Invalid ${label} pageNumber: ${entry.pageNumber}`);
    }
    if (seen.has(entry.pageNumber)) {
      throw new Error(`Duplicate ${label} pageNumber: ${entry.pageNumber}`);
    }
    seen.add(entry.pageNumber);
  }
}
