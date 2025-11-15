# Use Node.js 18 as base image
FROM node:18-slim

# Install system dependencies
# ffmpeg includes ffprobe
# python3 and pip3 are needed for yt-dlp
RUN apt-get update && \
    apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp using pip
# yt-dlp is a YouTube downloader that works better than youtube-dl
RUN pip3 install --no-cache-dir --upgrade pip && \
    pip3 install --no-cache-dir yt-dlp

# Verify installations
RUN ffmpeg -version && \
    ffprobe -version && \
    yt-dlp --version

# Set working directory
WORKDIR /app

# Copy package files from backend
COPY backend/package*.json ./

# Install Node.js dependencies
# Use npm ci for faster, reliable, reproducible builds
# Don't use --only=production to ensure all dependencies are available
RUN npm ci && \
    npm cache clean --force

# Copy application code from backend
COPY backend/ .

# Create uploads directory if it doesn't exist
RUN mkdir -p /app/uploads/temp /app/uploads/videos

# Set environment variables
ENV NODE_ENV=production
ENV UPLOAD_DIR=/app/uploads

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["npm", "start"]

