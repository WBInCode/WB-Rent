#!/bin/sh
# Usuwa wyłącznie rezerwację utworzoną przez test bezpieczeństwa (fikcyjny e-mail).
set -eu
APP_DIR="${APP_DIR:-/opt/wb-rent}"
COMPOSE="docker compose -f $APP_DIR/docker-compose.yml -f $APP_DIR/docker-compose.vps.yml"

q() { $COMPOSE exec -T db psql -U wbrent -d wbrent -tAc "$1"; }

echo "PRZED=$(q 'SELECT COUNT(*) FROM reservations')"
echo "DO_USUNIECIA=$(q "SELECT COALESCE(string_agg(id::text, ','), 'brak') FROM reservations WHERE email = 'nieistniejacy@example.com'")"

q "DELETE FROM reservation_items WHERE reservation_id IN (SELECT id FROM reservations WHERE email = 'nieistniejacy@example.com')" > /dev/null
q "DELETE FROM reservations WHERE email = 'nieistniejacy@example.com'" > /dev/null

echo "PO=$(q 'SELECT COUNT(*) FROM reservations')"
