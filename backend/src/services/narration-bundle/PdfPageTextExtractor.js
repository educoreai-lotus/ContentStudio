import { logger } from '../../infrastructure/logging/Logger.js';

/**
 * Extract text from each PDF page using pdf-parse's per-page pagerender.
 * Does NOT use blank-line heuristics. Does NOT modify FileTextExtractor.
 *
 * @param {Buffer} pdfBuffer
 * @returns {Promise<Array<{ pageNumber: number, text: string }>>}
 */
export async function extractPdfPageTexts(pdfBuffer) {
  if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
    throw new Error('pdfBuffer must be a non-empty Buffer');
  }

  let pdf;
  try {
    const pdfModule = await import('pdf-parse');
    pdf = pdfModule.default || pdfModule;
  } catch (importError) {
    throw new Error(`Failed to load pdf-parse: ${importError.message}`);
  }

  const pages = [];
  let sequentialPage = 0;

  const pagerender = async (pageData) => {
    sequentialPage += 1;
    const pageNumber =
      typeof pageData?.pageNumber === 'number' && pageData.pageNumber > 0
        ? pageData.pageNumber
        : sequentialPage;

    const renderOptions = {
      normalizeWhitespace: false,
      disableCombineTextItems: false,
    };

    let text = '';
    try {
      const textContent = await pageData.getTextContent(renderOptions);
      let lastY;
      for (const item of textContent.items || []) {
        if (lastY === item.transform[5] || lastY === undefined) {
          text += item.str;
        } else {
          text += `\n${item.str}`;
        }
        lastY = item.transform[5];
      }
    } catch (renderError) {
      logger.warn('[PdfPageTextExtractor] Failed to render page text', {
        pageNumber,
        error: renderError.message,
      });
      text = '';
    }

    pages.push({
      pageNumber,
      text: text.trim(),
    });

    return text;
  };

  await pdf(pdfBuffer, {
    pagerender,
    max: 0,
  });

  pages.sort((a, b) => a.pageNumber - b.pageNumber);

  logger.info('[PdfPageTextExtractor] Extracted page texts', {
    pageCount: pages.length,
  });

  return pages;
}
