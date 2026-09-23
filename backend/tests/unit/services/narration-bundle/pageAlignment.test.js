import { describe, it, expect } from '@jest/globals';
import { alignPagesByNumber } from '../../../../src/services/narration-bundle/pageAlignment.js';

describe('alignPagesByNumber', () => {
  it('accepts matching page texts and images', () => {
    const result = alignPagesByNumber(
      [
        { pageNumber: 2, text: 'two' },
        { pageNumber: 1, text: 'one' },
      ],
      [
        { pageNumber: 1, imagePath: '/tmp/slide-1.png' },
        { pageNumber: 2, imagePath: '/tmp/slide-2.png' },
      ]
    );

    expect(result).toEqual([
      { pageNumber: 1, text: 'one', imagePath: '/tmp/slide-1.png' },
      { pageNumber: 2, text: 'two', imagePath: '/tmp/slide-2.png' },
    ]);
  });

  it('rejects mismatched counts', () => {
    expect(() =>
      alignPagesByNumber(
        [{ pageNumber: 1, text: 'a' }],
        [
          { pageNumber: 1, imagePath: '/a.png' },
          { pageNumber: 2, imagePath: '/b.png' },
        ]
      )
    ).toThrow(/Page count mismatch/);
  });

  it('rejects missing image page', () => {
    expect(() =>
      alignPagesByNumber(
        [
          { pageNumber: 1, text: 'a' },
          { pageNumber: 2, text: 'b' },
        ],
        [
          { pageNumber: 1, imagePath: '/a.png' },
          { pageNumber: 3, imagePath: '/c.png' },
        ]
      )
    ).toThrow(/Missing image for pageNumber 2/);
  });

  it('rejects duplicate text page numbers', () => {
    expect(() =>
      alignPagesByNumber(
        [
          { pageNumber: 1, text: 'a' },
          { pageNumber: 1, text: 'b' },
        ],
        [
          { pageNumber: 1, imagePath: '/a.png' },
          { pageNumber: 2, imagePath: '/b.png' },
        ]
      )
    ).toThrow(/Duplicate text pageNumber/);
  });

  it('rejects duplicate image page numbers', () => {
    expect(() =>
      alignPagesByNumber(
        [
          { pageNumber: 1, text: 'a' },
          { pageNumber: 2, text: 'b' },
        ],
        [
          { pageNumber: 1, imagePath: '/a.png' },
          { pageNumber: 1, imagePath: '/b.png' },
        ]
      )
    ).toThrow(/Duplicate image pageNumber/);
  });
});
