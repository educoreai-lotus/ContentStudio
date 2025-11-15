# Railway FFmpeg & yt-dlp Setup

## Problem
Railway deployment was failing with errors:
- `ffprobe: command not found`
- `ffmpeg: command not found`
- `yt-dlp: command not found`

## Solution
Created a Dockerfile that installs all required system dependencies:
- **ffmpeg** - Video/audio processing (includes ffprobe)
- **python3** - Required for yt-dlp
- **python3-pip** - Python package manager
- **yt-dlp** - YouTube video downloader (installed via pip)

## Files Created

### 1. `Dockerfile`
- Installs system dependencies using `apt-get`
- Installs yt-dlp using `pip3`
- Verifies installations (ffmpeg, ffprobe, yt-dlp)
- Creates uploads directory structure
- Sets environment variables
- Configures health check

### 2. `railway.json`
- Updated to use Dockerfile instead of NIXPACKS
- Changed `builder` from `"NIXPACKS"` to `"DOCKERFILE"`
- Added `dockerfilePath: "Dockerfile"`

### 3. `.dockerignore`
- Excludes unnecessary files from Docker build
- Speeds up build process
- Reduces image size

## Installation Process

The Dockerfile installs:
1. **System packages** (via apt-get):
   - `ffmpeg` - Video/audio processing tool
   - `python3` - Python 3 interpreter
   - `python3-pip` - Python package manager
   - `curl` - For health checks
   - `ca-certificates` - For SSL/TLS

2. **Python packages** (via pip3):
   - `yt-dlp` - YouTube downloader (latest version)

## Verification

The Dockerfile includes verification steps:
```dockerfile
RUN ffmpeg -version && \
    ffprobe -version && \
    yt-dlp --version
```

This ensures all tools are installed correctly before building the image.

## Directory Structure

The Dockerfile creates:
- `/app/uploads/temp` - For temporary audio files
- `/app/uploads/videos` - For uploaded video files

## Environment Variables

The Dockerfile sets:
- `NODE_ENV=production`
- `UPLOAD_DIR=/app/uploads`

## Health Check

The Dockerfile includes a health check:
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1
```

## Deployment

After pushing these changes:
1. Railway will detect the Dockerfile
2. Build the Docker image with all dependencies
3. Deploy the container with ffmpeg, ffprobe, and yt-dlp installed
4. Video transcription should work correctly

## Testing

After deployment, test:
1. YouTube URL transcription - should work with yt-dlp
2. Video file upload - should work with ffmpeg/ffprobe
3. Audio detection - should work with ffprobe
4. Audio conversion - should work with ffmpeg

## Troubleshooting

If you still see errors:
1. Check Railway build logs for installation errors
2. Verify Dockerfile syntax is correct
3. Check that all system packages are installed
4. Verify yt-dlp is installed correctly
5. Check that PATH includes all tools

## Notes

- The Dockerfile uses `node:18-slim` as base image
- All tools are installed in system PATH
- The image size is optimized by removing apt cache
- Health check ensures the service is running correctly

