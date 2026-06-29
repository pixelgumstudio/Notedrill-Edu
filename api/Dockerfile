# ========================================
# Stage 1: Build
# ========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# 1. Copy root package files and workspace manifests
COPY package*.json ./
COPY turbo.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/validation/package*.json ./packages/validation/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/types/package*.json ./packages/types/

# 2. Install all dependencies (including devDeps for building)
RUN npm ci --include-workspace-root

# 3. Copy all source code
COPY . .

# 4. Build the API and all its local dependencies using Turbo
# This handles the building of @notedrill/validation, shared, and types automatically
RUN npx turbo run build --filter=@notedrill/api...

# ========================================
# Stage 2: Production
# ========================================
FROM node:20-alpine AS runner

WORKDIR /app

# Set environment
ENV NODE_ENV=production

# Install runtime dependencies
# curl: healthchecks | ffmpeg: audio conversion | yt-dlp: youtube audio download
RUN apk add --no-cache curl python3 py3-pip ffmpeg && \
    pip3 install --upgrade pip --break-system-packages && \
    pip3 install "yt-dlp[default]" bgutil-ytdlp-pot-provider --break-system-packages && \
    yt-dlp --version

# yt-dlp global config: use Node (already in image) as JS runtime for
# YouTube n-parameter/signature decryption, and fetch latest challenge
# solver scripts from GitHub to avoid stale-version failures.
RUN printf -- '--js-runtimes node\n--remote-components ejs:github\n' \
    > /etc/yt-dlp.conf

# 1. Copy package manifests for production install
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/validation/package*.json ./packages/validation/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/types/package*.json ./packages/types/

# 2. Install production-only dependencies
RUN npm ci --omit=dev --workspace=apps/api --include-workspace-root

# 3. Copy built files from the builder stage
# Copy the compiled JS from the API
COPY --from=builder /app/apps/api/dist ./apps/api/dist
# Copy the compiled JS from your internal packages
COPY --from=builder /app/packages/validation/dist ./packages/validation/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/types/dist ./packages/types/dist

# 4. Security: Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose the API port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Start the application
# The WORKDIR is important so node finds the correct dist/server.js
WORKDIR /app/apps/api
CMD ["node", "dist/server.js"]