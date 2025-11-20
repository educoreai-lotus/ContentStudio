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
# Auto-detect source directory: prefer /src/backend if it exists and has package.json, otherwise use /src
RUN set -e; \
    APP_SRC=/src; \
    if [ -d /src/backend ] && [ -f /src/backend/package.json ]; then \
        APP_SRC=/src/backend; \
        echo "Detected backend directory: ${APP_SRC}"; \
    elif [ -f /src/package.json ]; then \
        APP_SRC=/src; \
        echo "Using root source directory: ${APP_SRC}"; \
    else \
        echo "ERROR: package.json not found!"; \
        echo "Contents of /src:"; \
        ls -la /src/ || true; \
        if [ -d /src/backend ]; then \
            echo "Contents of /src/backend:"; \
            ls -la /src/backend/ || true; \
        fi; \
        exit 1; \
    fi; \
    echo "Copying package files from ${APP_SRC}"; \
    cp ${APP_SRC}/package*.json ./ && \
    npm ci && \
    npm cache clean --force

# Copy application code from detected app dir inside the image
RUN set -e; \
    APP_SRC=/src; \
    if [ -d /src/backend ] && [ -f /src/backend/package.json ]; then \
        APP_SRC=/src/backend; \
    fi; \
    echo "Copying application code from ${APP_SRC}"; \
    cp -R ${APP_SRC}/. . && \
    rm -rf /src

# Create uploads directory if it doesn't exist
RUN mkdir -p /app/uploads/temp /app/uploads/videos

# Set environment variables
ENV NODE_ENV=production
ENV UPLOAD_DIR=/app/uploads

# Expose port
EXPOSE 3000

# Health check
# start-period gives the container time to start before health checks begin
# interval is how often to check after start-period
# timeout is how long to wait for each check
# retries is how many consecutive failures before marking unhealthy
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["npm", "start"]

