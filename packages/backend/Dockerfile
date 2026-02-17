# Multi-stage build for Tanuki Temaki backend

# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./
COPY packages/backend/package.json ./packages/backend/
COPY shared/package.json ./shared/

# Install pnpm and dependencies
RUN npm install -g pnpm@9
RUN pnpm install --frozen-lockfile

# Copy source code
COPY shared ./shared
COPY packages/backend ./packages/backend

# Build shared types
WORKDIR /app/shared
RUN pnpm build

# Generate Prisma client and build backend
WORKDIR /app/packages/backend
RUN npx prisma generate
RUN pnpm build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/backend/package.json ./packages/backend/
COPY shared/package.json ./shared/

# Install all dependencies (needed for Prisma CLI)
RUN pnpm install --frozen-lockfile

# Copy built artifacts from builder
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder /app/packages/backend/prisma ./packages/backend/prisma
COPY --from=builder /app/shared/dist ./shared/dist

# Generate Prisma client in production
WORKDIR /app/packages/backend
RUN pnpm prisma generate

# Create logs directory
RUN mkdir -p /app/packages/backend/logs

WORKDIR /app/packages/backend

# Expose ports (HTTP API and WebSocket)
EXPOSE 3000 8765

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); });"

# Start the server
CMD ["node", "dist/server.js"]
