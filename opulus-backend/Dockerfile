# Multi-stage build for backend service
FROM node:18-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy root package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy package.json files for all workspaces
COPY opulus-core/package.json ./opulus-core/
COPY opulus-backend/package.json ./opulus-backend/

# Install dependencies (production only)
RUN pnpm install --frozen-lockfile --prod=false

# Copy source code
COPY opulus-core ./opulus-core
COPY opulus-backend ./opulus-backend

# Build core package first (dependency)
RUN pnpm --filter @opulus/core build

# Build backend package
RUN pnpm --filter @opulus/backend build

# Production stage
FROM node:18-alpine AS production

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY --from=base /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=base /app/opulus-core/package.json ./opulus-core/
COPY --from=base /app/opulus-backend/package.json ./opulus-backend/

# Copy node_modules (with production dependencies)
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/opulus-core/node_modules ./opulus-core/node_modules
COPY --from=base /app/opulus-backend/node_modules ./opulus-backend/node_modules

# Copy built code
COPY --from=base /app/opulus-core/dist ./opulus-core/dist
COPY --from=base /app/opulus-backend/dist ./opulus-backend/dist

# Copy Prisma schema and generated client
COPY --from=base /app/opulus-core/prisma ./opulus-core/prisma

# Generate Prisma client
RUN pnpm --filter @opulus/core prisma:generate

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the server
CMD ["pnpm", "--filter", "@opulus/backend", "start"]


