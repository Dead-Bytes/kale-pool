# KALE Pool Mining - Production Dockerfile
FROM oven/bun:1.1.20-alpine AS base

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    postgresql-client \
    curl \
    ca-certificates

# Copy package files
COPY package.json bun.lock ./
COPY Shared ./Shared/
COPY ext ./ext/

# Install dependencies
RUN bun install --production

# Copy source code
COPY start-backend.ts ./

# Build the application
WORKDIR /app/Backend
RUN bun run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S bun -u 1001

# Change to non-root user
USER bun

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start the application
WORKDIR /app
CMD ["bun", "run", "start-backend.ts"]