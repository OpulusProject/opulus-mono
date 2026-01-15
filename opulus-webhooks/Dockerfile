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

# Generate Prisma client first (needed for opulus-core build)
# Must run from opulus-core directory for schema path to resolve correctly
RUN cd opulus-core && pnpm exec prisma generate --schema=./prisma/schema.prisma

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

# Copy Prisma schema and migrations
COPY --from=base /app/opulus-core/prisma ./opulus-core/prisma

# Generate Prisma client
RUN pnpm --filter @opulus/core prisma:generate

# Expose port
EXPOSE 8081

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8081/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start script: run migrations, then start server
# Migrations run automatically on container start (for Railway and other platforms)
# Note: pnpm --filter changes working directory, so use relative path from opulus-core
CMD pnpm --filter @opulus/core exec prisma migrate deploy --schema=./prisma/schema.prisma && \
    pnpm --filter @opulus/webhooks start


