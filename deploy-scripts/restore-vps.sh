#!/bin/sh
set -eu

APP_DIR="${APP_DIR:-/opt/wb-rent}"
DB_DUMP="${DB_DUMP:-$APP_DIR/upload/wbrent.sql}"
CONTRACT_ARCHIVE="${CONTRACT_ARCHIVE:-$APP_DIR/upload/wbrent-contracts.tar.gz}"
IMAGE_ARCHIVE="${IMAGE_ARCHIVE:-$APP_DIR/upload/wbrent-product-images.tar.gz}"
DOCUMENT_ARCHIVE="${DOCUMENT_ARCHIVE:-$APP_DIR/upload/wbrent-documents.tar.gz}"
COMPOSE="docker compose -f $APP_DIR/docker-compose.yml -f $APP_DIR/docker-compose.vps.yml"

if [ ! -f "$DB_DUMP" ] || [ ! -f "$CONTRACT_ARCHIVE" ]; then
  echo "Restore artifacts are missing" >&2
  exit 1
fi

$COMPOSE stop web api
$COMPOSE exec -T db dropdb -U wbrent --if-exists --force wbrent
$COMPOSE exec -T db createdb -U wbrent -O wbrent wbrent
$COMPOSE exec -T db psql -U wbrent -d wbrent < "$DB_DUMP"

api_container="$($COMPOSE ps -a -q api)"
contract_volume="$(docker inspect "$api_container" --format '{{range .Mounts}}{{if eq .Destination "/app/storage/contracts"}}{{.Name}}{{end}}{{end}}')"
image_volume="$(docker inspect "$api_container" --format '{{range .Mounts}}{{if eq .Destination "/app/storage/product-images"}}{{.Name}}{{end}}{{end}}')"
if [ -z "$contract_volume" ] || [ -z "$image_volume" ]; then
  echo "Contract or product image volume not found on API container" >&2
  exit 1
fi
docker run --rm \
  -v "$contract_volume:/data" \
  -v "$APP_DIR/upload:/restore:ro" \
  alpine:3.21 \
  sh -c 'rm -rf /data/* && tar xzf /restore/wbrent-contracts.tar.gz -C /data && chown -R 1000:1000 /data'
if [ -f "$IMAGE_ARCHIVE" ]; then
  docker run --rm \
    -v "$image_volume:/data" \
    -v "$APP_DIR/upload:/restore:ro" \
    alpine:3.21 \
    sh -c 'rm -rf /data/* && tar xzf /restore/wbrent-product-images.tar.gz -C /data && chown -R 1000:1000 /data'
fi

document_volume="$(docker inspect "$api_container" --format '{{range .Mounts}}{{if eq .Destination "/app/storage/documents"}}{{.Name}}{{end}}{{end}}')"
if [ -n "$document_volume" ] && [ -f "$DOCUMENT_ARCHIVE" ]; then
  docker run --rm \
    -v "$document_volume:/data" \
    -v "$APP_DIR/upload:/restore:ro" \
    alpine:3.21 \
    sh -c 'rm -rf /data/* && tar xzf /restore/wbrent-documents.tar.gz -C /data && chown -R 1000:1000 /data'
fi

$COMPOSE up -d api web

reservations="$($COMPOSE exec -T db psql -U wbrent -d wbrent -tAc 'SELECT COUNT(*) FROM reservations')"
contracts="$($COMPOSE exec -T db psql -U wbrent -d wbrent -tAc 'SELECT COUNT(*) FROM rental_contracts')"
files="$(docker run --rm -v "$contract_volume:/data:ro" alpine:3.21 sh -c 'find /data -type f | wc -l')"
printf 'RESTORE reservations=%s contracts=%s encrypted_files=%s\n' "$reservations" "$contracts" "$files"