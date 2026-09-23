import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  buildSlideSceneCommand,
  createSlideScene,
  formatSceneDurationForFfmpeg,
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
  VIDEO_FPS,
  SCALE_PAD_FILTER,
} from '../../../../src/services/narrated-video/videoEncodingDefaults.js';

describe('formatSceneDurationForFfmpeg', () => {
  it('formats finite positive durations stably', () => {
    expect(formatSceneDurationForFfmpeg(20.832)).toBe('20.832');
    expect(formatSceneDurationForFfmpeg(10)).toBe('10');
  });

  it('rejects invalid durations', () => {
    expect(() => formatSceneDurationForFfmpeg(0)).toThrow(/Invalid scene duration/);
    expect(() => formatSceneDurationForFfmpeg(NaN)).toThrow(/Invalid scene duration/);
  });
});

describe('buildSlideSceneCommand', () => {
  it('pins input framerate, output -r, and output -t duration', () => {
    const command = buildSlideSceneCommand({
      imagePath: 'C:/tmp/slide-1.png',
      audioPath: 'C:/tmp/audio-1.mp3',
      outputPath: 'C:/tmp/scene-1.mp4',
      duration: 20.832,
    });

    expect(command).toMatch(
      new RegExp(`ffmpeg -y -loop 1 -framerate ${VIDEO_FPS} -i .*slide-1\\.png`)
    );
    expect(command).toContain('audio-1.mp3');
    expect(command).toContain(`-c:v ${VIDEO_CODEC}`);
    expect(command).toContain('-tune stillimage');
    expect(command).toContain(`-c:a ${AUDIO_CODEC}`);
    expect(command).toContain(`-pix_fmt ${PIXEL_FORMAT}`);
    expect(command).toContain(`-r ${VIDEO_FPS}`);
    expect(command).toContain(`-vf "${SCALE_PAD_FILTER}"`);
    expect(command).toContain('force_original_aspect_ratio=decrease');
    expect(command).toContain(`pad=${VIDEO_WIDTH}:${VIDEO_HEIGHT}`);
    expect(command).toContain('-t 20.832');
    expect(command).toContain('-shortest');
    expect(command).toContain('scene-1.mp4');

    // -framerate must appear before image -i; -t must be an output option (after codecs, before output)
    const framerateIdx = command.indexOf(`-framerate ${VIDEO_FPS}`);
    const imageInputIdx = command.indexOf('-i ');
    const tIdx = command.indexOf('-t 20.832');
    const shortestIdx = command.indexOf('-shortest');
    const outIdx = command.lastIndexOf('scene-1.mp4');
    expect(framerateIdx).toBeGreaterThan(-1);
    expect(framerateIdx).toBeLessThan(imageInputIdx);
    expect(tIdx).toBeGreaterThan(command.indexOf(`-r ${VIDEO_FPS}`));
    expect(tIdx).toBeLessThan(shortestIdx);
    expect(shortestIdx).toBeLessThan(outIdx);
  });

  it('rejects missing/invalid duration', () => {
    expect(() =>
      buildSlideSceneCommand({
        imagePath: 'a.png',
        audioPath: 'a.mp3',
        outputPath: 'o.mp4',
        duration: 0,
      })
    ).toThrow(/duration must be a finite number > 0/);
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

  it('requires duration and invokes ffmpeg with pinned -t', async () => {
    const execAsync = jest.fn().mockImplementation(async () => {
      writeFileSync(outputPath, Buffer.from('fake-mp4'));
      return { stdout: '', stderr: '' };
    });

    const result = await createSlideScene({
      imagePath,
      audioPath,
      outputPath,
      duration: 12.5,
      execAsync,
    });

    expect(execAsync).toHaveBeenCalledTimes(1);
    const command = execAsync.mock.calls[0][0];
    expect(command).toContain(`-loop 1 -framerate ${VIDEO_FPS}`);
    expect(command).toContain('audio-1.mp3');
    expect(command).toContain('-t 12.5');
    expect(command).toContain(`-r ${VIDEO_FPS}`);
    expect(command).toContain('-shortest');
    expect(result.outputPath).toBe(outputPath);
  });

  it('rejects missing duration', async () => {
    await expect(
      createSlideScene({
        imagePath,
        audioPath,
        outputPath,
      })
    ).rejects.toThrow(/duration must be a finite number > 0/);
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
