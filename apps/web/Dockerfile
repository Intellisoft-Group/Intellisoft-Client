FROM node:20-alpine AS build
WORKDIR /repo
ARG NEXT_PUBLIC_API_URL=https://api-client.theintellisoft.com
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci --workspace=@intellisoft/web --include-workspace-root
COPY apps/web apps/web
WORKDIR /repo/apps/web
RUN npm run build

# Runtime path MUST stay /repo — Next standalone bakes outputFileTracingRoot=/repo.
FROM node:20-alpine
RUN apk add --no-cache wget
ENV NODE_ENV=production
ENV PORT=3002
ENV HOSTNAME=0.0.0.0
WORKDIR /repo
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
WORKDIR /repo/apps/web
EXPOSE 3002
HEALTHCHECK --interval=20s --timeout=5s --start-period=40s --retries=6 \
  CMD wget -qO- http://127.0.0.1:3002/robots.txt >/dev/null || exit 1
CMD ["node", "server.js"]
