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

# Install yt-dlp using pip with --break-system-packages flag
# Python 3.11+ in Debian 12 blocks system-wide pip installations
# Using --break-system-packages is safe in Docker containers (isolated environment)
# Alternative: pipx might not be available in Debian 12, so using pip with flag
RUN pip3 install --no-cache-dir --upgrade pip --break-system-packages && \
    pip3 install --no-cache-dir --break-system-packages yt-dlp

# Verify installations
RUN ffmpeg -version && \
    ffprobe -version && \
    yt-dlp --version

# Set working directory
WORKDIR /app

# Support building from repo root or backend/ context without depending on host paths
# Auto-detect source dir inside the image (prefers /src/backend if exists)

# Always copy the entire build context into the image first
COPY . /src

# Install Node.js dependencies
# Use npm ci for faster, reliable, reproducible builds
# Don't use --only=production to ensure all dependencies are available
# Copy package files from detected app dir inside the image, then install
RUN APP_SRC=/src; \
    if [ -d /src/backend ]; then APP_SRC=/src/backend; fi; \
    cp ${APP_SRC}/package*.json ./ && \
    npm ci && \
    npm cache clean --force

# Copy application code from detected app dir inside the image
RUN APP_SRC=/src; \
    if [ -d /src/backend ]; then APP_SRC=/src/backend; fi; \
    cp -R ${APP_SRC}/. .

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

