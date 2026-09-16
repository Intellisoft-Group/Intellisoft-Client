#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE="docker compose --env-file $ENV_FILE -f docker-compose.prod.yml"
STAMP="$(date +%F-%H%M)"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"

POSTGRES_USER="${POSTGRES_USER:-intellisoft}"
POSTGRES_DB="${POSTGRES_DB:-intellisoft}"

echo "Backing up PostgreSQL to $BACKUP_DIR/db-$STAMP.sql"
$COMPOSE exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$BACKUP_DIR/db-$STAMP.sql"

echo "Backing up uploads volume to $BACKUP_DIR/uploads-$STAMP.tar.gz"
$COMPOSE exec -T api sh -c 'cd /app && tar czf - uploads' > "$BACKUP_DIR/uploads-$STAMP.tar.gz"

echo "Done. Keep at least 7 daily copies off-server."
