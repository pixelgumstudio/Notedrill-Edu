# ========================================
# Stage 1: Build
# ========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace manifests
COPY package*.json ./
COPY notedrill-edu/package*.json ./notedrill-edu/
COPY packages/types/package*.json ./packages/types/
COPY packages/validation/package*.json ./packages/validation/
COPY packages/shared/package*.json ./packages/shared/

# Install all deps from workspace root (resolves workspace symlinks)
RUN npm install

# Copy full source
COPY packages/ ./packages/
COPY notedrill-edu/ ./notedrill-edu/

# API URL is baked into the JS bundle at build time
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build:web

# ========================================
# Stage 2: Production runner
# ========================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy only what Next.js needs to run
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/notedrill-edu/package.json ./notedrill-edu/
COPY --from=builder /app/notedrill-edu/next.config.ts ./notedrill-edu/
COPY --from=builder /app/notedrill-edu/public ./notedrill-edu/public
COPY --from=builder /app/notedrill-edu/.next ./notedrill-edu/.next

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

WORKDIR /app/notedrill-edu

EXPOSE 3002

CMD ["npm", "run", "start"]
