FROM node:20-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --workspace=@intellisoft/api --include-workspace-root
COPY apps/api apps/api
COPY packages/shared packages/shared
WORKDIR /repo/apps/api
RUN npx prisma generate && npx tsc -p tsconfig.build.json
WORKDIR /repo
RUN npm prune --omit=dev

FROM node:20-alpine
RUN apk add --no-cache wget
WORKDIR /app
ENV NODE_ENV=production
ENV NODE_PATH=/repo/node_modules
ENV PATH="/repo/node_modules/.bin:${PATH}"
COPY --from=build /repo/node_modules /repo/node_modules
COPY --from=build /repo/apps/api /app
COPY --from=build /repo/packages /repo/packages
RUN chmod +x docker-entrypoint.sh
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ready || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
