FROM node:20-alpine AS build
WORKDIR /repo
ARG NEXT_PUBLIC_API_URL=https://api-client.theintellisoft.com
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY package.json package-lock.json ./
COPY apps/cms/package.json apps/cms/package.json
RUN npm ci --workspace=@intellisoft/cms --include-workspace-root
COPY apps/cms apps/cms
WORKDIR /repo/apps/cms
RUN npm run build

# Runtime path MUST stay /repo — Next standalone bakes outputFileTracingRoot=/repo.
FROM node:20-alpine
RUN apk add --no-cache wget
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
WORKDIR /repo
COPY --from=build /repo/apps/cms/.next/standalone ./
COPY --from=build /repo/apps/cms/.next/static ./apps/cms/.next/static
COPY --from=build /repo/apps/cms/public ./apps/cms/public
WORKDIR /repo/apps/cms
EXPOSE 3001
HEALTHCHECK --interval=20s --timeout=5s --start-period=40s --retries=6 \
  CMD wget -qO- http://127.0.0.1:3001/robots.txt >/dev/null || exit 1
CMD ["node", "server.js"]
