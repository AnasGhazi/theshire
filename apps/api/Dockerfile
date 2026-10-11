# Build context: repository root.
FROM node:24-slim AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @theshire/api --include-workspace-root
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @theshire/api

FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
# The API launches sandbox containers through the Docker CLI (see docs/security.md).
COPY --from=docker:29-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=build /repo/package.json /repo/package-lock.json ./
COPY --from=build /repo/apps/api/package.json apps/api/
COPY --from=build /repo/packages/shared/package.json packages/shared/
COPY --from=build /repo/apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace @theshire/api && npm cache clean --force
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --chmod=0555 apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint
EXPOSE 4000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint"]
CMD ["node", "apps/api/dist/server.js"]
