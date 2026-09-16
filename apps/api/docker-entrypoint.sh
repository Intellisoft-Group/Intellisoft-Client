#!/bin/sh
set -e

# Workspace installs live under /repo/node_modules (not /app).
# Bare `npx prisma` would download Prisma 7 and break our Prisma 6 schema.
PRISMA_BIN="/repo/node_modules/.bin/prisma"
if [ ! -x "$PRISMA_BIN" ]; then
  echo "ERROR: Prisma CLI not found at $PRISMA_BIN"
  ls -la /repo/node_modules/.bin 2>/dev/null || true
  exit 1
fi

echo "Applying database migrations (Prisma $($PRISMA_BIN -v | head -n1))..."
"$PRISMA_BIN" migrate deploy

echo "Starting API..."
exec node dist/main
