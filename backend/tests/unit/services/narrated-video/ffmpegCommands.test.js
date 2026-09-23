import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  buildSlideSceneCommand,
  createSlideScene,
} from '../../../../src/services/narrated-video/createSlideScene.js';
import {
  buildVideoConcatCommand,
  concatenateVideoScenes,
} from '../../../../src/services/narrated-video/concatenateVideoScenes.js';
import {
  VIDEO_CODEC,
  AUDIO_CODEC,
  PIXEL_FORMAT,
  VIDEO_WIDTH,
  VIDEO_HEIGHT,
  SCALE_PAD_FILTER,
} from '../../../../src/services/narrated-video/videoEncodingDefaults.js';

describe('buildSlideSceneCommand', () => {
  it('configures H.264, AAC, yuv420p, loop, shortest, scale+pad, MP4', () => {
    const command = buildSlideSceneCommand({
      imagePath: 'C:/tmp/slide-1.png',
      audioPath: 'C:/tmp/audio-1.mp3',
      outputPath: 'C:/tmp/scene-1.mp4',
    });

    expect(command).toContain('ffmpeg -y -loop 1 -i');
    expect(command).toContain('slide-1.png');
    expect(command).toContain('audio-1.mp3');
    expect(command).toContain(`-c:v ${VIDEO_CODEC}`);
    expect(command).toContain('-tune stillimage');
    expect(command).toContain(`-c:a ${AUDIO_CODEC}`);
    expect(command).toContain(`-pix_fmt ${PIXEL_FORMAT}`);
    expect(command).toContain('-shortest');
    expect(command).toContain(`-vf "${SCALE_PAD_FILTER}"`);
    expect(command).toContain(`force_original_aspect_ratio=decrease`);
    expect(command).toContain(`pad=${VIDEO_WIDTH}:${VIDEO_HEIGHT}`);
    expect(command).toContain('scene-1.mp4');
    expect(command).not.toContain('scale=1920:1080 ');
  });

  it('preserves aspect ratio without stretching', () => {
    expect(SCALE_PAD_FILTER).toContain('force_original_aspect_ratio=decrease');
    expect(SCALE_PAD_FILTER).toContain(`scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}`);
    expect(SCALE_PAD_FILTER).toContain(`pad=${VIDEO_WIDTH}:${VIDEO_HEIGHT}`);
  });
});

describe('createSlideScene', () => {
  let dir;
  let imagePath;
  let audioPath;
  let outputPath;

  beforeEach(() => {
    dir = join(tmpdir(), `scene-cmd-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    mkdirSync(dir, { recursive: true });
    imagePath = join(dir, 'slide-1.png');
    audioPath = join(dir, 'audio-1.mp3');
    outputPath = join(dir, 'scene-1.mp4');
    writeFileSync(imagePath, Buffer.from('png'));
    writeFileSync(audioPath, Buffer.from('mp3'));
  });

  afterEach(() => {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('invokes ffmpeg with image+audio inputs and writes output path', async () => {
    const execAsync = jest.fn().mockImplementation(async () => {
      writeFileSync(outputPath, Buffer.from('fake-mp4'));
      return { stdout: '', stderr: '' };
    });

    const result = await createSlideScene({
      imagePath,
      audioPath,
      outputPath,
      execAsync,
    });

    expect(execAsync).toHaveBeenCalledTimes(1);
    const command = execAsync.mock.calls[0][0];
    expect(command).toContain('-loop 1');
    expect(command).toContain(imagePath.replace(/\\/g, '/').includes('/') ? 'slide-1.png' : 'slide-1.png');
    expect(command).toContain('audio-1.mp3');
    expect(command).toContain(`-c:v ${VIDEO_CODEC}`);
    expect(command).toContain(`-c:a ${AUDIO_CODEC}`);
    expect(command).toContain(`-pix_fmt ${PIXEL_FORMAT}`);
    expect(command).toContain('-shortest');
    expect(result.outputPath).toBe(outputPath);
  });
});

describe('buildVideoConcatCommand', () => {
  it('uses concat demuxer with stream copy', () => {
    const command = buildVideoConcatCommand('/tmp/video-concat.txt', '/tmp/final-video.mp4');
    expect(command).toContain('ffmpeg -y -f concat -safe 0 -i');
    expect(command).toContain('video-concat.txt');
    expect(command).toContain('-c copy');
    expect(command).toContain('final-video.mp4');
  });
});

describe('concatenateVideoScenes', () => {
  let dir;

  beforeEach(() => {
    dir = join(tmpdir(), `concat-cmd-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    mkdirSync(dir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes concat list in given scene order and runs ffmpeg -c copy', async () => {
    const scene1 = join(dir, 'scene-1.mp4');
    const scene2 = join(dir, 'scene-2.mp4');
    const scene3 = join(dir, 'scene-3.mp4');
    writeFileSync(scene1, Buffer.from('s1'));
    writeFileSync(scene2, Buffer.from('s2'));
    writeFileSync(scene3, Buffer.from('s3'));

    const outputPath = join(dir, 'final-video.mp4');
    const execAsync = jest.fn().mockImplementation(async () => {
      writeFileSync(outputPath, Buffer.from('final'));
      return { stdout: '', stderr: '' };
    });

    await concatenateVideoScenes({
      scenePaths: [scene1, scene2, scene3],
      outputPath,
      workingDirectory: dir,
      execAsync,
    });

    const listContent = readFileSync(join(dir, 'video-concat.txt'), 'utf8');
    const lines = listContent.split('\n');
    expect(lines[0]).toContain('scene-1.mp4');
    expect(lines[1]).toContain('scene-2.mp4');
    expect(lines[2]).toContain('scene-3.mp4');
    expect(listContent.indexOf('scene-1.mp4')).toBeLessThan(listContent.indexOf('scene-2.mp4'));
    expect(listContent.indexOf('scene-2.mp4')).toBeLessThan(listContent.indexOf('scene-3.mp4'));

    expect(execAsync).toHaveBeenCalledTimes(1);
    expect(execAsync.mock.calls[0][0]).toContain('-c copy');
  });
});
