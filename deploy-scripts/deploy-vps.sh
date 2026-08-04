#!/bin/sh
# Wdrożenie WB-Rent: rozpakowanie źródeł + przebudowa wyłącznie api/web.
# Nie dotyka bazy, Traefika ani innych stacków na serwerze.
set -eu

APP_DIR="${APP_DIR:-/opt/wb-rent}"
ARCHIVE="${ARCHIVE:-/tmp/wb-rent-deploy.tar.gz}"
COMPOSE="docker compose -f $APP_DIR/docker-compose.yml -f $APP_DIR/docker-compose.vps.yml"

if [ ! -f "$ARCHIVE" ]; then
  echo "Brak archiwum $ARCHIVE" >&2
  exit 1
fi

echo "== Rozpakowuję źródła =="
tar xzf "$ARCHIVE" -C "$APP_DIR"

echo "== Buduję api i web (bez zależności) =="
$COMPOSE build --no-cache api web

echo "== Restartuję api i web =="
$COMPOSE up -d --no-deps api web

echo "== Status =="
$COMPOSE ps

rm -f "$ARCHIVE"
echo "DEPLOY_OK"
