import { describe, it, expect } from '@jest/globals';
import { alignPresentationWithBundle } from '../../../../src/services/narrated-video/alignPresentationWithBundle.js';

describe('alignPresentationWithBundle', () => {
  const images = [
    { pageNumber: 1, imagePath: '/tmp/slide-1.png' },
    { pageNumber: 2, imagePath: '/tmp/slide-2.png' },
  ];

  const slides = [
    { pageNumber: 1, narration: 'A', audioBuffer: Buffer.from('audio-1'), duration: 1.5 },
    { pageNumber: 2, narration: 'B', audioBuffer: Buffer.from('audio-2'), duration: 2.5 },
  ];

  it('accepts valid aligned pages and returns numeric page order', () => {
    const shuffledImages = [images[1], images[0]];
    const shuffledSlides = [slides[1], slides[0]];

    const result = alignPresentationWithBundle(shuffledImages, {
      slides: shuffledSlides,
    });

    expect(result.map((r) => r.pageNumber)).toEqual([1, 2]);
    expect(result[0].imagePath).toContain('slide-1.png');
    expect(result[0].audioBuffer.equals(Buffer.from('audio-1'))).toBe(true);
    expect(result[1].audioBuffer.equals(Buffer.from('audio-2'))).toBe(true);
  });

  it('rejects missing narration page', () => {
    expect(() =>
      alignPresentationWithBundle(images, {
        slides: [slides[0]],
      })
    ).toThrow(/Page count mismatch/);
  });

  it('rejects when a pageNumber is present in images but missing from slides', () => {
    expect(() =>
      alignPresentationWithBundle(images, {
        slides: [
          slides[0],
          { pageNumber: 3, narration: 'C', audioBuffer: Buffer.from('x'), duration: 1 },
        ],
      })
    ).toThrow(/Missing narration slide for pageNumber 2|Missing image for pageNumber 3/);
  });

  it('rejects extra narration page (unknown page vs images)', () => {
    expect(() =>
      alignPresentationWithBundle([images[0]], {
        slides: slides,
      })
    ).toThrow(/Page count mismatch/);
  });

  it('rejects duplicate image page numbers', () => {
    expect(() =>
      alignPresentationWithBundle(
        [
          { pageNumber: 1, imagePath: '/a.png' },
          { pageNumber: 1, imagePath: '/b.png' },
        ],
        { slides: [slides[0], slides[1]] }
      )
    ).toThrow(/Duplicate image pageNumber: 1/);
  });

  it('rejects duplicate narration page numbers', () => {
    expect(() =>
      alignPresentationWithBundle(images, {
        slides: [
          slides[0],
          { pageNumber: 1, narration: 'dup', audioBuffer: Buffer.from('x'), duration: 1 },
        ],
      })
    ).toThrow(/Duplicate narration pageNumber: 1/);
  });

  it('rejects missing audioBuffer', () => {
    expect(() =>
      alignPresentationWithBundle(images, {
        slides: [
          { pageNumber: 1, narration: 'A', duration: 1.5 },
          slides[1],
        ],
      })
    ).toThrow(/Missing or empty audioBuffer for pageNumber 1/);
  });

  it('rejects empty audioBuffer', () => {
    expect(() =>
      alignPresentationWithBundle(images, {
        slides: [
          { pageNumber: 1, narration: 'A', audioBuffer: Buffer.alloc(0), duration: 1.5 },
          slides[1],
        ],
      })
    ).toThrow(/Missing or empty audioBuffer for pageNumber 1/);
  });

  it('rejects invalid duration', () => {
    expect(() =>
      alignPresentationWithBundle(images, {
        slides: [
          { pageNumber: 1, narration: 'A', audioBuffer: Buffer.from('a'), duration: 0 },
          slides[1],
        ],
      })
    ).toThrow(/Invalid duration for pageNumber 1/);
  });

  it('rejects non-finite duration', () => {
    expect(() =>
      alignPresentationWithBundle(images, {
        slides: [
          { pageNumber: 1, narration: 'A', audioBuffer: Buffer.from('a'), duration: NaN },
          slides[1],
        ],
      })
    ).toThrow(/Invalid duration for pageNumber 1/);
  });
});
