/**
 * Test suite for SlideImageExtractor
 * Tests slide image extraction, upload path, and ordering
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { SlideImageExtractor } from '../../../src/services/SlideImageExtractor.js';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import JSZip from 'jszip';

// Mock SupabaseStorageClient
class MockStorageClient {
  constructor() {
    this.uploads = [];
    this.isConfiguredValue = true;
  }

  isConfigured() {
    return this.isConfiguredValue;
  }

  async uploadFile(fileBuffer, fileName, contentType) {
    this.uploads.push({
      fileName,
      contentType,
      size: fileBuffer.length,
    });

    // Return mock URL
    return {
      url: `https://storage.example.com/${fileName}`,
      path: fileName,
      sha256Hash: 'mock-hash',
      digitalSignature: 'mock-signature',
    };
  }
}

describe('SlideImageExtractor', () => {
  let extractor;
  let mockStorageClient;
  let tempDir;

  beforeEach(() => {
    mockStorageClient = new MockStorageClient();
    extractor = new SlideImageExtractor(mockStorageClient, 'content');
    tempDir = join(tmpdir(), `slide-extract-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    // Cleanup temp files
    try {
      if (existsSync(tempDir)) {
        // Remove temp directory contents
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('Constructor', () => {
    it('should create SlideImageExtractor with storage client', () => {
      expect(extractor).toBeInstanceOf(SlideImageExtractor);
      expect(extractor.storageClient).toBe(mockStorageClient);
    });

    it('should throw error if storage client is missing', () => {
      expect(() => new SlideImageExtractor(null)).toThrow('Storage client is required');
    });
  });

  describe('extractSlideImages - Validation', () => {
    it('should throw error if jobId is missing', async () => {
      const pptxBuffer = Buffer.from('fake-pptx');
      await expect(extractor.extractSlideImages(pptxBuffer, '')).rejects.toThrow('Job ID is required');
      await expect(extractor.extractSlideImages(pptxBuffer, null)).rejects.toThrow('Job ID is required');
    });

    it('should throw error if maxSlides is invalid', async () => {
      const pptxBuffer = Buffer.from('fake-pptx');
      await expect(extractor.extractSlideImages(pptxBuffer, 'job-1', 0)).rejects.toThrow('maxSlides must be between 1 and 10');
      await expect(extractor.extractSlideImages(pptxBuffer, 'job-1', 11)).rejects.toThrow('maxSlides must be between 1 and 10');
    });

    it('should throw error if pptxInput is invalid', async () => {
      await expect(extractor.extractSlideImages(null, 'job-1')).rejects.toThrow('pptxInput must be a file path');
      await expect(extractor.extractSlideImages({}, 'job-1')).rejects.toThrow('pptxInput must be a file path');
    });
  });

  describe('extractSlideImages - PPTX Structure', () => {
    it('should throw error if PPTX has no slides', async () => {
      // Create a minimal invalid PPTX (just a ZIP with no slides)
      const zip = new JSZip();
      zip.file('ppt/presentation.xml', '<?xml version="1.0"?><presentation/>');
      const pptxBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      await expect(extractor.extractSlideImages(pptxBuffer, 'job-1')).rejects.toThrow('No slides found in PPTX file');
    });

    it('should throw error if PPTX is not a valid ZIP', async () => {
      const invalidBuffer = Buffer.from('not-a-pptx-file');
      await expect(extractor.extractSlideImages(invalidBuffer, 'job-1')).rejects.toThrow('Invalid PPTX file');
    });
  });

  describe('extractSlideImages - Embedded Images Fallback', () => {
    it('should extract and upload embedded images', async () => {
      // Create a mock PPTX with slides and embedded images
      const zip = new JSZip();
      
      // Add slide XML files
      zip.file('ppt/slides/slide1.xml', '<?xml version="1.0"?><slide/>');
      zip.file('ppt/slides/slide2.xml', '<?xml version="1.0"?><slide/>');
      
      // Add embedded images
      const image1Buffer = Buffer.from('fake-png-image-1');
      const image2Buffer = Buffer.from('fake-png-image-2');
      zip.file('ppt/media/image1.png', image1Buffer);
      zip.file('ppt/media/image2.png', image2Buffer);
      
      const pptxBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      // Mock LibreOffice to fail (so we test fallback)
      const originalExtract = extractor._extractUsingLibreOffice;
      extractor._extractUsingLibreOffice = jest.fn().mockRejectedValue(new Error('LibreOffice not available'));

      const results = await extractor.extractSlideImages(pptxBuffer, 'test-job', 2);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        index: 1,
        imageUrl: expect.stringContaining('heygen/slides/test-job/slide-01.png'),
      });
      expect(results[1]).toEqual({
        index: 2,
        imageUrl: expect.stringContaining('heygen/slides/test-job/slide-02.png'),
      });

      // Verify uploads
      expect(mockStorageClient.uploads).toHaveLength(2);
      expect(mockStorageClient.uploads[0].fileName).toBe('heygen/slides/test-job/slide-01.png');
      expect(mockStorageClient.uploads[1].fileName).toBe('heygen/slides/test-job/slide-02.png');

      // Restore original method
      extractor._extractUsingLibreOffice = originalExtract;
    });

    it('should handle maxSlides limit', async () => {
      const zip = new JSZip();
      
      // Add 5 slides
      for (let i = 1; i <= 5; i++) {
        zip.file(`ppt/slides/slide${i}.xml`, '<?xml version="1.0"?><slide/>');
      }
      
      // Add images
      for (let i = 1; i <= 5; i++) {
        zip.file(`ppt/media/image${i}.png`, Buffer.from(`fake-image-${i}`));
      }
      
      const pptxBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      // Mock LibreOffice to fail
      const originalExtract = extractor._extractUsingLibreOffice;
      extractor._extractUsingLibreOffice = jest.fn().mockRejectedValue(new Error('LibreOffice not available'));

      // Request only 3 slides
      const results = await extractor.extractSlideImages(pptxBuffer, 'test-job', 3);

      expect(results).toHaveLength(3);
      expect(results.map(r => r.index)).toEqual([1, 2, 3]);
      expect(mockStorageClient.uploads).toHaveLength(3);

      // Restore original method
      extractor._extractUsingLibreOffice = originalExtract;
    });

    it('should throw error if no embedded images found and LibreOffice fails', async () => {
      const zip = new JSZip();
      zip.file('ppt/slides/slide1.xml', '<?xml version="1.0"?><slide/>');
      // No media files
      const pptxBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      // Mock LibreOffice to fail
      const originalExtract = extractor._extractUsingLibreOffice;
      extractor._extractUsingLibreOffice = jest.fn().mockRejectedValue(new Error('LibreOffice not available'));

      await expect(extractor.extractSlideImages(pptxBuffer, 'test-job', 1)).rejects.toThrow('No images found');

      // Restore original method
      extractor._extractUsingLibreOffice = originalExtract;
    });
  });

  describe('Deterministic Naming', () => {
    it('should use deterministic file naming pattern', async () => {
      const zip = new JSZip();
      zip.file('ppt/slides/slide1.xml', '<?xml version="1.0"?><slide/>');
      zip.file('ppt/slides/slide2.xml', '<?xml version="1.0"?><slide/>');
      zip.file('ppt/media/image1.png', Buffer.from('fake-image'));
      zip.file('ppt/media/image2.png', Buffer.from('fake-image'));
      
      const pptxBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      // Mock LibreOffice to fail
      const originalExtract = extractor._extractUsingLibreOffice;
      extractor._extractUsingLibreOffice = jest.fn().mockRejectedValue(new Error('LibreOffice not available'));

      const jobId = 'job-abc-123';
      const results = await extractor.extractSlideImages(pptxBuffer, jobId, 2);

      expect(mockStorageClient.uploads[0].fileName).toBe(`heygen/slides/${jobId}/slide-01.png`);
      expect(mockStorageClient.uploads[1].fileName).toBe(`heygen/slides/${jobId}/slide-02.png`);

      // Restore original method
      extractor._extractUsingLibreOffice = originalExtract;
    });

    it('should pad slide numbers with zeros', async () => {
      const zip = new JSZip();
      for (let i = 1; i <= 10; i++) {
        zip.file(`ppt/slides/slide${i}.xml`, '<?xml version="1.0"?><slide/>');
        zip.file(`ppt/media/image${i}.png`, Buffer.from(`fake-image-${i}`));
      }
      
      const pptxBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      // Mock LibreOffice to fail
      const originalExtract = extractor._extractUsingLibreOffice;
      extractor._extractUsingLibreOffice = jest.fn().mockRejectedValue(new Error('LibreOffice not available'));

      const results = await extractor.extractSlideImages(pptxBuffer, 'test-job', 10);

      expect(results[0].imageUrl).toContain('slide-01.png');
      expect(results[9].imageUrl).toContain('slide-10.png');

      // Restore original method
      extractor._extractUsingLibreOffice = originalExtract;
    });
  });

  describe('Error Handling', () => {
    it('should handle storage upload failures gracefully', async () => {
      const zip = new JSZip();
      zip.file('ppt/slides/slide1.xml', '<?xml version="1.0"?><slide/>');
      zip.file('ppt/media/image1.png', Buffer.from('fake-image'));
      
      const pptxBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      // Mock storage to fail
      mockStorageClient.uploadFile = jest.fn().mockRejectedValue(new Error('Storage upload failed'));

      // Mock LibreOffice to fail
      const originalExtract = extractor._extractUsingLibreOffice;
      extractor._extractUsingLibreOffice = jest.fn().mockRejectedValue(new Error('LibreOffice not available'));

      await expect(extractor.extractSlideImages(pptxBuffer, 'test-job', 1)).rejects.toThrow();

      // Restore original method
      extractor._extractUsingLibreOffice = originalExtract;
    });

    it('should provide actionable error messages', async () => {
      const zip = new JSZip();
      zip.file('ppt/slides/slide1.xml', '<?xml version="1.0"?><slide/>');
      // No images
      const pptxBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      // Mock LibreOffice to fail
      const originalExtract = extractor._extractUsingLibreOffice;
      extractor._extractUsingLibreOffice = jest.fn().mockRejectedValue(new Error('LibreOffice not available'));

      try {
        await extractor.extractSlideImages(pptxBuffer, 'test-job', 1);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('No images found');
        expect(error.message).toContain('LibreOffice');
      }

      // Restore original method
      extractor._extractUsingLibreOffice = originalExtract;
    });
  });

  describe('Slide Ordering', () => {
    it('should return slides in correct order (1..N)', async () => {
      const zip = new JSZip();
      
      // Add slides in non-sequential order
      zip.file('ppt/slides/slide3.xml', '<?xml version="1.0"?><slide/>');
      zip.file('ppt/slides/slide1.xml', '<?xml version="1.0"?><slide/>');
      zip.file('ppt/slides/slide2.xml', '<?xml version="1.0"?><slide/>');
      
      zip.file('ppt/media/image1.png', Buffer.from('fake-image-1'));
      zip.file('ppt/media/image2.png', Buffer.from('fake-image-2'));
      zip.file('ppt/media/image3.png', Buffer.from('fake-image-3'));
      
      const pptxBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      // Mock LibreOffice to fail
      const originalExtract = extractor._extractUsingLibreOffice;
      extractor._extractUsingLibreOffice = jest.fn().mockRejectedValue(new Error('LibreOffice not available'));

      const results = await extractor.extractSlideImages(pptxBuffer, 'test-job', 3);

      // Results should be sorted by index
      expect(results.map(r => r.index)).toEqual([1, 2, 3]);

      // Restore original method
      extractor._extractUsingLibreOffice = originalExtract;
    });
  });
});

