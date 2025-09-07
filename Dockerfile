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
COPY package.json ./
COPY Shared ./Shared/
COPY ext ./ext/

# Install dependencies
RUN bun install --production

# Copy all source code
COPY src ./src/
COPY start-backend.ts ./
COPY tsconfig.json ./

# Build the application
RUN bun run build

# Change ownership of the app directory to existing bun user
RUN chown -R bun:bun /app

# Change to non-root user
USER bun

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start the application
CMD ["bun", "run", "start"]