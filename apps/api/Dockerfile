# VibeNovel API — Node staging image (Task 11.4)
# Build from repo root:
#   docker build -f apps/api/Dockerfile -t vibenovel-api-staging .
# Run:
#   docker run --env-file .env.staging -p 8787:8787 vibenovel-api-staging

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace @vibenovel/shared --workspace @vibenovel/api --include-workspace-root

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @vibenovel/shared
RUN npm run build:node -w @vibenovel/api

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -g 1001 -S vibenovel && \
    adduser -S vibenovel -u 1001 -G vibenovel

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/packages/shared/package.json packages/shared/
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/package.json apps/api/
COPY --from=build /app/apps/api/dist-node apps/api/dist-node

USER vibenovel
WORKDIR /app/apps/api
EXPOSE 8787
CMD ["node", "dist-node/node-server.js"]