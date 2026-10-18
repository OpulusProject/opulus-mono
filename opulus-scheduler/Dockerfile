# Multi-stage build for the scheduler service
FROM node:22-alpine AS base

RUN apk add --no-cache python3 make g++ && \
    corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# Copy root package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy package.json files for the workspaces this service needs
COPY opulus-core/package.json ./opulus-core/
COPY opulus-scheduler/package.json ./opulus-scheduler/

RUN pnpm install --frozen-lockfile --prod=false

# Copy source code
COPY opulus-core ./opulus-core
COPY opulus-scheduler ./opulus-scheduler

# Generate the Prisma client (needed to build core), then build core and the scheduler
RUN cd opulus-core && pnpm exec prisma generate --schema=./prisma/schema.prisma
RUN pnpm --filter @opulus/core build
RUN pnpm --filter @opulus/scheduler build

# Production stage
FROM node:22-alpine AS production

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

COPY --from=base /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=base /app/opulus-core/package.json ./opulus-core/
COPY --from=base /app/opulus-scheduler/package.json ./opulus-scheduler/

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/opulus-core/node_modules ./opulus-core/node_modules
COPY --from=base /app/opulus-scheduler/node_modules ./opulus-scheduler/node_modules

COPY --from=base /app/opulus-core/dist ./opulus-core/dist
COPY --from=base /app/opulus-scheduler/dist ./opulus-scheduler/dist

# The schema, for generating the client. Migrations are applied by the backend
# and webhooks services on their start, not here (Prisma only applies the ones
# not yet applied, and takes a lock while it does)
COPY --from=base /app/opulus-core/prisma ./opulus-core/prisma
RUN pnpm --filter @opulus/core prisma:generate

EXPOSE 8082

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8082/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD pnpm --filter @opulus/scheduler start
