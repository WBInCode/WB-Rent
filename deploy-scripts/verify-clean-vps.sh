#!/bin/sh
set -eu

APP_DIR="${APP_DIR:-/opt/wb-rent}"
COMPOSE="docker compose -f $APP_DIR/docker-compose.yml -f $APP_DIR/docker-compose.vps.yml"

counts="$(cat <<'SQL' | $COMPOSE exec -T db psql -U wbrent -d wbrent -tA -F ','
SELECT
  (SELECT COUNT(*) FROM reservations),
  (SELECT COUNT(*) FROM reservation_items),
  (SELECT COUNT(*) FROM rental_contracts),
  (SELECT COUNT(*) FROM payments),
  (SELECT COUNT(*) FROM reservation_term_changes),
  (SELECT COUNT(*) FROM reservation_status_changes),
  (SELECT COUNT(*) FROM contacts),
  (SELECT COUNT(*) FROM contact_replies),
  (SELECT COUNT(*) FROM newsletter_subscribers),
  (SELECT COUNT(*) FROM newsletter_posts),
  (SELECT COUNT(*) FROM product_notifications),
  (SELECT COUNT(*) FROM app_settings),
  (SELECT COUNT(*) FROM documents),
  (SELECT COUNT(*) FROM discounts),
  (SELECT COUNT(*) FROM coupons),
  (SELECT COUNT(*) FROM products),
  (SELECT COUNT(*) FROM products WHERE jsonb_array_length(images) >= 1 AND images->>0 = image),
  (SELECT COUNT(*) FROM schema_migrations);
SQL
)"

api_container="$($COMPOSE ps -q api)"
contract_volume="$(docker inspect "$api_container" --format '{{range .Mounts}}{{if eq .Destination "/app/storage/contracts"}}{{.Name}}{{end}}{{end}}')"
contract_files="$(docker run --rm -v "$contract_volume:/data:ro" alpine:3.21 sh -c 'find /data -type f | wc -l')"
document_volume="$(docker inspect "$api_container" --format '{{range .Mounts}}{{if eq .Destination "/app/storage/documents"}}{{.Name}}{{end}}{{end}}')"
document_files="$(docker run --rm -v "$document_volume:/data:ro" alpine:3.21 sh -c 'find /data -type f | wc -l')"
health="$(curl -fsS http://127.0.0.1:5340/api/health)"

echo "COUNTS reservations,items,contracts,payments,term_changes,status_changes,contacts,replies,subscribers,posts,notifications,settings,documents,discounts,coupons,products,galleries_with_primary,migrations=$counts"
echo "CONTRACT_FILES=$contract_files"
echo "DOCUMENT_FILES=$document_files"
echo "HEALTH=$health"

if [ "$counts" != '0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,11,11' ] || [ "$contract_files" != '0' ] || [ "$document_files" != '0' ]; then
  echo 'CLEAN_INSTALL=no'
  exit 1
fi
echo 'CLEAN_INSTALL=yes'