/**
 * Centralized FFmpeg encoding settings for narrated presentation video scenes.
 * All scenes must share these so concat -c copy is safe.
 */
export const VIDEO_WIDTH = 1920;
export const VIDEO_HEIGHT = 1080;
export const VIDEO_FPS = 30;
export const VIDEO_CODEC = 'libx264';
export const AUDIO_CODEC = 'aac';
export const PIXEL_FORMAT = 'yuv420p';
export const AUDIO_BITRATE = '192k';

/**
 * Scale to fit 1920x1080 preserving aspect ratio; pad with black (no stretch).
 */
export const SCALE_PAD_FILTER =
  `scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=decrease,` +
  `pad=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:(ow-iw)/2:(oh-ih)/2:black`;

/**
 * Allowed absolute difference (seconds) between final video duration and
 * narrationBundle.combinedAudioDuration.
 */
export const FINAL_DURATION_TOLERANCE_SECONDS = 1.0;
