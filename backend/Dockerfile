# Use Node.js 20 as base image (LTS, more stable registry availability)
FROM node:20-slim

# Install system dependencies
# ffmpeg includes ffprobe
# python3 and pip3 are needed for yt-dlp
# poppler-utils includes pdftoppm for PDF to image conversion (required for avatar videos)
RUN apt-get update && \
    apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    curl \
    ca-certificates \
    poppler-utils \
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
    yt-dlp --version && \
    pdftoppm -v

# Set working directory
WORKDIR /app

# Copy package files (including package-lock.json)
COPY package.json package-lock.json* ./

# Install Node.js dependencies
# Use npm ci if package-lock.json exists, otherwise use npm install
# Don't use --only=production to ensure all dependencies are available
RUN if [ -f package-lock.json ]; then \
        npm ci && \
        npm cache clean --force; \
    else \
        npm install && \
        npm cache clean --force; \
    fi

# Copy application code
COPY . .

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
