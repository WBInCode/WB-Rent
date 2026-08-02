#!/bin/sh
set -eu
umask 077

APP_DIR="${APP_DIR:-/opt/wb-rent}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
COMPOSE="docker compose -f $APP_DIR/docker-compose.yml -f $APP_DIR/docker-compose.vps.yml"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

$COMPOSE exec -T db pg_dump -U wbrent -d wbrent | gzip > "$BACKUP_DIR/wbrent-$STAMP.sql.gz"

api_container="$($COMPOSE ps -q api)"
CONTRACT_VOLUME="$(docker inspect "$api_container" --format '{{range .Mounts}}{{if eq .Destination "/app/storage/contracts"}}{{.Name}}{{end}}{{end}}')"
IMAGE_VOLUME="$(docker inspect "$api_container" --format '{{range .Mounts}}{{if eq .Destination "/app/storage/product-images"}}{{.Name}}{{end}}{{end}}')"
DOCUMENT_VOLUME="$(docker inspect "$api_container" --format '{{range .Mounts}}{{if eq .Destination "/app/storage/documents"}}{{.Name}}{{end}}{{end}}')"
if [ -z "$CONTRACT_VOLUME" ] || [ -z "$IMAGE_VOLUME" ]; then
  echo "Contract or product image volume not found on API container" >&2
  exit 1
fi
docker run --rm \
  -v "${CONTRACT_VOLUME}:/data:ro" \
  -v "$BACKUP_DIR:/backups" \
  alpine:3.21 \
  tar czf "/backups/wbrent-contracts-$STAMP.tar.gz" -C /data .
docker run --rm \
  -v "${IMAGE_VOLUME}:/data:ro" \
  -v "$BACKUP_DIR:/backups" \
  alpine:3.21 \
  tar czf "/backups/wbrent-product-images-$STAMP.tar.gz" -C /data .
chmod 600 \
  "$BACKUP_DIR/wbrent-$STAMP.sql.gz" \
  "$BACKUP_DIR/wbrent-contracts-$STAMP.tar.gz" \
  "$BACKUP_DIR/wbrent-product-images-$STAMP.tar.gz"

# Document archive holds manually uploaded signed contracts - back it up when present.
if [ -n "$DOCUMENT_VOLUME" ]; then
  docker run --rm \
    -v "${DOCUMENT_VOLUME}:/data:ro" \
    -v "$BACKUP_DIR:/backups" \
    alpine:3.21 \
    tar czf "/backups/wbrent-documents-$STAMP.tar.gz" -C /data .
  chmod 600 "$BACKUP_DIR/wbrent-documents-$STAMP.tar.gz"
fi

find "$BACKUP_DIR" -type f -name 'wbrent-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -type f -name 'wbrent-contracts-*.tar.gz' -mtime "+$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -type f -name 'wbrent-product-images-*.tar.gz' -mtime "+$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -type f -name 'wbrent-documents-*.tar.gz' -mtime "+$RETENTION_DAYS" -delete

echo "Backup completed: $STAMP"