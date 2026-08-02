#!/bin/sh
set -eu
APP_DIR="${APP_DIR:-/opt/wb-rent}"
COMPOSE="docker compose -f $APP_DIR/docker-compose.yml -f $APP_DIR/docker-compose.vps.yml"

echo "--- dokumenty w archiwum ---"
$COMPOSE exec -T db psql -U wbrent -d wbrent -c \
  "SELECT id, title, category, source, size_bytes, reservation_id, archived_at FROM documents ORDER BY id"

echo "--- powiazanie z umowami ---"
$COMPOSE exec -T db psql -U wbrent -d wbrent -tAc \
  "SELECT COUNT(*) FROM rental_contracts c JOIN documents d ON d.file_path = c.pdf_path"
