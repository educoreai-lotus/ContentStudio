import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { extractLocalPdfPageImages } from '../../../../src/services/narration-bundle/LocalPdfPageImageExtractor.js';
import { measureAudioDuration } from '../../../../src/services/narration-bundle/measureAudioDuration.js';
import {
  concatenateAudioFiles,
  buildAudioConcatCommand,
} from '../../../../src/services/narration-bundle/concatenateAudioFiles.js';

describe('LocalPdfPageImageExtractor', () => {
  let workingDirectory;

  beforeEach(() => {
    workingDirectory = join(tmpdir(), `local-pdf-img-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    mkdirSync(workingDirectory, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(workingDirectory)) {
      rmSync(workingDirectory, { recursive: true, force: true });
    }
  });

  it('maps pdftoppm output files to pageNumbers in numeric order', async () => {
    const execAsync = jest.fn().mockImplementation(async () => {
      writeFileSync(join(workingDirectory, 'slide-2.png'), Buffer.from('png2'));
      writeFileSync(join(workingDirectory, 'slide-1.png'), Buffer.from('png1'));
      writeFileSync(join(workingDirectory, 'slide-10.png'), Buffer.from('png10'));
      return { stdout: '', stderr: '' };
    });

    const result = await extractLocalPdfPageImages({
      pdfBuffer: Buffer.from('%PDF-fake'),
      workingDirectory,
      execAsync,
    });

    expect(execAsync).toHaveBeenCalledTimes(1);
    expect(execAsync.mock.calls[0][0]).toContain('pdftoppm -png -r 150');
    expect(result.map((r) => r.pageNumber)).toEqual([1, 2, 10]);
    expect(result[0].imagePath).toContain('slide-1.png');
  });

  it('fails when pdftoppm produces no images', async () => {
    const execAsync = jest.fn().mockResolvedValue({ stdout: '', stderr: '' });
    await expect(
      extractLocalPdfPageImages({
        pdfBuffer: Buffer.from('%PDF-fake'),
        workingDirectory,
        execAsync,
      })
    ).rejects.toThrow(/no slide-\*\.png/);
  });
});

describe('measureAudioDuration', () => {
  let audioPath;
  let dir;

  beforeEach(() => {
    dir = join(tmpdir(), `ffprobe-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    audioPath = join(dir, 'a.mp3');
    writeFileSync(audioPath, Buffer.from('fake-mp3'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('parses valid ffprobe duration', async () => {
    const duration = await measureAudioDuration(audioPath, {
      execAsync: async () => ({ stdout: '12.345\n', stderr: '' }),
    });
    expect(duration).toBeCloseTo(12.345);
  });

  it('rejects invalid duration', async () => {
    await expect(
      measureAudioDuration(audioPath, {
        execAsync: async () => ({ stdout: 'N/A\n', stderr: '' }),
      })
    ).rejects.toThrow(/Invalid audio duration/);
  });

  it('rejects zero duration', async () => {
    await expect(
      measureAudioDuration(audioPath, {
        execAsync: async () => ({ stdout: '0\n', stderr: '' }),
      })
    ).rejects.toThrow(/Invalid audio duration/);
  });
});

describe('concatenateAudioFiles', () => {
  let dir;

  beforeEach(() => {
    dir = join(tmpdir(), `concat-audio-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('builds concat command with list and output paths', () => {
    const command = buildAudioConcatCommand('/tmp/list.txt', '/tmp/out.mp3');
    expect(command).toContain('ffmpeg -y -f concat -safe 0 -i');
    expect(command).toContain('-c copy');
  });

  it('preserves page audio order in concat list and produces output', async () => {
    const a1 = join(dir, 'audio-1.mp3');
    const a2 = join(dir, 'audio-2.mp3');
    writeFileSync(a1, Buffer.from('one'));
    writeFileSync(a2, Buffer.from('two'));
    const outputPath = join(dir, 'combined-audio.mp3');

    const execAsync = jest.fn().mockImplementation(async () => {
      writeFileSync(outputPath, Buffer.from('combined'));
      return { stdout: '', stderr: '' };
    });

    const result = await concatenateAudioFiles({
      audioPaths: [a1, a2],
      outputPath,
      workingDirectory: dir,
      execAsync,
      measureDurationFn: async () => 9.5,
    });

    expect(execAsync).toHaveBeenCalledTimes(1);
    const command = execAsync.mock.calls[0][0];
    expect(command).toContain('ffmpeg -y -f concat');
    expect(result.duration).toBe(9.5);
    expect(existsSync(outputPath)).toBe(true);

    const listPath = join(dir, 'audio-concat.txt');
    expect(existsSync(listPath)).toBe(true);
    const listContent = (await import('fs')).readFileSync(listPath, 'utf8');
    const idx1 = listContent.indexOf('audio-1.mp3');
    const idx2 = listContent.indexOf('audio-2.mp3');
    expect(idx1).toBeGreaterThanOrEqual(0);
    expect(idx2).toBeGreaterThan(idx1);
  });
});
