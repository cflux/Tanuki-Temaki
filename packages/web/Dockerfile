# Multi-stage build for Tanuki Temaki frontend

# Stage 1: Builder
FROM node:20-alpine AS builder

# Build-time arguments for API URLs
ARG VITE_API_URL
ARG VITE_WS_URL

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/web/package.json ./packages/web/
COPY shared/package.json ./shared/

# Install pnpm and dependencies
RUN npm install -g pnpm@9
RUN pnpm install --frozen-lockfile

# Copy source code
COPY shared ./shared
COPY packages/web ./packages/web

# Build shared types
WORKDIR /app/shared
RUN pnpm build

# Build frontend
WORKDIR /app/packages/web
RUN pnpm build

# Stage 2: Production with Nginx
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html

# Copy nginx configuration
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
