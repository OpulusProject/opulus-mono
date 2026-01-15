# Multi-stage build for webhook service
FROM node:18-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy root package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy package.json files for all workspaces
COPY opulus-core/package.json ./opulus-core/
COPY opulus-webhooks/package.json ./opulus-webhooks/

# Install dependencies (production only)
RUN pnpm install --frozen-lockfile --prod=false

# Copy source code
COPY opulus-core ./opulus-core
COPY opulus-webhooks ./opulus-webhooks

# Build core package first (dependency)
RUN pnpm --filter @opulus/core build

# Build webhook package
RUN pnpm --filter @opulus/webhooks build

# Production stage
FROM node:18-alpine AS production

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY --from=base /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=base /app/opulus-core/package.json ./opulus-core/
COPY --from=base /app/opulus-webhooks/package.json ./opulus-webhooks/

# Copy node_modules (with production dependencies)
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/opulus-core/node_modules ./opulus-core/node_modules
COPY --from=base /app/opulus-webhooks/node_modules ./opulus-webhooks/node_modules

# Copy built code
COPY --from=base /app/opulus-core/dist ./opulus-core/dist
COPY --from=base /app/opulus-webhooks/dist ./opulus-webhooks/dist

# Copy Prisma schema and generated client (if webhooks need it)
COPY --from=base /app/opulus-core/prisma ./opulus-core/prisma

# Generate Prisma client (if needed)
RUN pnpm --filter @opulus/core prisma:generate || true

# Expose port
EXPOSE 8081

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8081/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the server
CMD ["pnpm", "--filter", "@opulus/webhooks", "start"]


