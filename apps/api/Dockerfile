# Build context: repository root.

# Native modules (better-sqlite3) may need compiling when no prebuilt binary matches the platform.
FROM node:24-slim AS toolchain
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

FROM toolchain AS build
RUN npm ci --workspace @theshire/api --include-workspace-root
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @theshire/api

FROM toolchain AS prod-deps
RUN npm ci --omit=dev --workspace @theshire/api && npm cache clean --force

FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
# The API launches sandbox containers through the Docker CLI (see docs/security.md).
COPY --from=docker:29-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=prod-deps /repo ./
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY content content
RUN mkdir -p /app/data && chown 1000:1000 /app/data
ENV COURSES_DIR=/app/content/courses DATABASE_PATH=/app/data/theshire.db
COPY --chmod=0555 apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint
EXPOSE 4000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint"]
CMD ["node", "apps/api/dist/server.js"]
