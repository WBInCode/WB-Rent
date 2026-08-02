#!/bin/sh
# Weryfikacja po wdrożeniu: schemat, dane oferty, nagłówki bezpieczeństwa.
set -eu

APP_DIR="${APP_DIR:-/opt/wb-rent}"
COMPOSE="docker compose -f $APP_DIR/docker-compose.yml -f $APP_DIR/docker-compose.vps.yml"

q() {
  $COMPOSE exec -T db psql -U wbrent -d wbrent -tAc "$1"
}

echo "MIGRACJA=$(q 'SELECT MAX(version) FROM schema_migrations')"
echo "TABELE=$(q "SELECT string_agg(table_name, ',' ORDER BY table_name) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('documents','discounts','coupons')")"
echo "KOL_REZERWACJI=$(q "SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.columns WHERE table_name='reservations' AND column_name LIKE 'discount%'")"
echo "KOL_PRODUKTU=$(q "SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.columns WHERE table_name='products' AND column_name IN ('features','included_accessories','optional_accessories','accessory_price')")"
echo "PRODUKTY=$(q 'SELECT COUNT(*) FROM products')"
echo "Z_CECHAMI=$(q "SELECT COUNT(*) FROM products WHERE jsonb_array_length(features) > 0")"
echo "Z_OPISEM=$(q "SELECT COUNT(*) FROM products WHERE description <> ''")"
echo "Z_AKCESORIAMI=$(q "SELECT COUNT(*) FROM products WHERE jsonb_array_length(included_accessories) > 0")"
echo "GALERIE=$(q "SELECT COUNT(*) FROM products WHERE jsonb_array_length(images) >= 1")"
echo "REZERWACJE=$(q 'SELECT COUNT(*) FROM reservations')"
echo "DOKUMENTY=$(q 'SELECT COUNT(*) FROM documents')"

echo "--- wolumen dokumentow ---"
api_container="$($COMPOSE ps -q api)"
docker inspect "$api_container" --format '{{range .Mounts}}{{if eq .Destination "/app/storage/documents"}}DOCUMENTS_VOLUME={{.Name}}{{end}}{{end}}'

echo "--- health ---"
curl -fsS http://127.0.0.1:5340/api/health
echo ""

echo "--- naglowki bezpieczenstwa ---"
curl -sSI https://wb-rent.pl/ | grep -iE 'content-security-policy|x-frame-options|x-content-type-options|referrer-policy|strict-transport|permissions-policy' || echo 'BRAK NAGLOWKOW'

echo "--- robots.txt ---"
curl -fsS https://wb-rent.pl/robots.txt
