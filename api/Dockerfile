# ========================================
# Stage 1: Build
# ========================================
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

# Copy workspace manifests first (better layer caching)
COPY package*.json ./
COPY api/package*.json ./api/
COPY packages/types/package*.json ./packages/types/
COPY packages/validation/package*.json ./packages/validation/
COPY packages/shared/package*.json ./packages/shared/

# Install all dependencies from workspace root
RUN npm ci

# Copy full source
COPY packages/ ./packages/
COPY api/ ./api/

# Build shared packages (if they have build scripts), then the API
RUN npm run build --workspaces --if-present || true
RUN npm run build:api

# ========================================
# Stage 2: Production runner
# ========================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Runtime tools: yt-dlp for YouTube transcription, ffmpeg for audio processing
RUN apk add --no-cache curl python3 py3-pip ffmpeg && \
    pip3 install --upgrade pip --break-system-packages && \
    pip3 install "yt-dlp[default]" --break-system-packages

# Copy workspace manifests for production install
COPY package*.json ./
COPY api/package*.json ./api/
COPY packages/types/package*.json ./packages/types/
COPY packages/validation/package*.json ./packages/validation/
COPY packages/shared/package*.json ./packages/shared/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy compiled outputs from builder
COPY --from=builder /app/api/dist ./api/dist
COPY --from=builder /app/packages ./packages

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 8081

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8081/health || exit 1

CMD ["node", "api/dist/server.js"]
