#!/bin/sh
set -eu
APP_DIR="${APP_DIR:-/opt/wb-rent}"
COMPOSE="docker compose -f $APP_DIR/docker-compose.yml -f $APP_DIR/docker-compose.vps.yml"

q() { $COMPOSE exec -T db psql -U wbrent -d wbrent -tAc "$1"; }

echo "MIGRACJA=$(q 'SELECT MAX(version) FROM schema_migrations')"
echo "TABELA_ZDJEC=$(q "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='reservation_photos'")"
echo "KOL_CENY=$(q "SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.columns WHERE table_name='reservations' AND column_name IN ('price_override_note','price_set_by')")"
echo "ZDJECIA=$(q 'SELECT COUNT(*) FROM reservation_photos')"
echo "REZERWACJE=$(q 'SELECT COUNT(*) FROM reservations')"
echo "DOKUMENTY=$(q 'SELECT COUNT(*) FROM documents')"

echo "--- logi api ---"
$COMPOSE logs api --tail 8
