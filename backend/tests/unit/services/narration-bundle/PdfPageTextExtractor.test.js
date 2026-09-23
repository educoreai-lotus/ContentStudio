import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockPdf = jest.fn();

jest.unstable_mockModule('pdf-parse', () => ({
  default: mockPdf,
}));

describe('extractPdfPageTexts', () => {
  beforeEach(() => {
    mockPdf.mockReset();
  });

  it('returns one entry per rendered page with pageNumber and trimmed text', async () => {
    mockPdf.mockImplementation(async (_buffer, options) => {
      await options.pagerender({
        pageNumber: 1,
        getTextContent: async () => ({
          items: [
            { str: '  Hello  ', transform: [1, 0, 0, 1, 0, 10] },
            { str: 'World', transform: [1, 0, 0, 1, 0, 10] },
          ],
        }),
      });
      await options.pagerender({
        pageNumber: 2,
        getTextContent: async () => ({
          items: [{ str: 'Page two', transform: [1, 0, 0, 1, 0, 20] }],
        }),
      });
      await options.pagerender({
        pageNumber: 3,
        getTextContent: async () => ({ items: [] }),
      });
      return { text: '', numpages: 3 };
    });

    const { extractPdfPageTexts } = await import(
      '../../../../src/services/narration-bundle/PdfPageTextExtractor.js'
    );

    const pages = await extractPdfPageTexts(Buffer.from('%PDF'));

    expect(mockPdf).toHaveBeenCalledTimes(1);
    expect(mockPdf.mock.calls[0][1].pagerender).toBeDefined();
    expect(pages).toEqual([
      { pageNumber: 1, text: 'Hello  World' },
      { pageNumber: 2, text: 'Page two' },
      { pageNumber: 3, text: '' },
    ]);
  });

  it('rejects non-buffer input', async () => {
    const { extractPdfPageTexts } = await import(
      '../../../../src/services/narration-bundle/PdfPageTextExtractor.js'
    );
    await expect(extractPdfPageTexts(null)).rejects.toThrow(/non-empty Buffer/);
  });
});
