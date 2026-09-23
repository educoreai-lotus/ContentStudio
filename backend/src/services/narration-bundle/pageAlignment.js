/**
 * Align page texts with local slide images by pageNumber.
 * Fails clearly on mismatch — never silently truncates.
 *
 * @param {Array<{ pageNumber: number, text: string }>} pageTexts
 * @param {Array<{ pageNumber: number, imagePath: string }>} pageImages
 * @returns {Array<{ pageNumber: number, text: string, imagePath: string }>}
 */
export function alignPagesByNumber(pageTexts, pageImages) {
  if (!Array.isArray(pageTexts) || !Array.isArray(pageImages)) {
    throw new Error('pageTexts and pageImages must be arrays');
  }

  if (pageTexts.length === 0 || pageImages.length === 0) {
    throw new Error('pageTexts and pageImages must be non-empty');
  }

  if (pageTexts.length !== pageImages.length) {
    throw new Error(
      `Page count mismatch: ${pageTexts.length} text page(s) vs ${pageImages.length} image page(s)`
    );
  }

  assertUniquePageNumbers(pageTexts, 'text');
  assertUniquePageNumbers(pageImages, 'image');

  const textByPage = new Map(pageTexts.map((p) => [p.pageNumber, p]));
  const imageByPage = new Map(pageImages.map((p) => [p.pageNumber, p]));

  const textPages = [...textByPage.keys()].sort((a, b) => a - b);
  const imagePages = [...imageByPage.keys()].sort((a, b) => a - b);

  for (const pageNumber of textPages) {
    if (!imageByPage.has(pageNumber)) {
      throw new Error(`Missing image for pageNumber ${pageNumber}`);
    }
  }
  for (const pageNumber of imagePages) {
    if (!textByPage.has(pageNumber)) {
      throw new Error(`Missing text for pageNumber ${pageNumber}`);
    }
  }

  return textPages.map((pageNumber) => {
    const textEntry = textByPage.get(pageNumber);
    const imageEntry = imageByPage.get(pageNumber);
    return {
      pageNumber,
      text: textEntry.text ?? '',
      imagePath: imageEntry.imagePath,
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
