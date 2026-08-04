#!/bin/sh
set -eu

APP_DIR="${APP_DIR:-/opt/wb-rent}"
COMPOSE="docker compose -f $APP_DIR/docker-compose.yml -f $APP_DIR/docker-compose.vps.yml"
CREDENTIALS_FILE="$APP_DIR/.initial-admin-credentials"

password="$(sed -n 's/^Password: //p' "$CREDENTIALS_FILE")"
login="$(curl -fsS \
  -H 'Content-Type: application/json' \
  --data "{\"password\":\"$password\"}" \
  http://127.0.0.1:5340/api/admin/login)"
token="$(printf '%s' "$login" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')"
if [ -z "$token" ]; then
  echo 'ADMIN_LOGIN=failed'
  exit 1
fi

contract_id="$(printf "SELECT id FROM rental_contracts WHERE status='signed' ORDER BY id DESC LIMIT 1\n" | $COMPOSE exec -T db psql -U wbrent -d wbrent -tA)"
if [ -z "$contract_id" ]; then
  echo 'ADMIN_LOGIN=ok'
  echo 'SIGNED_CONTRACTS=0'
  echo 'PDF_CHECK=not_applicable_clean_install'
  echo 'TOKEN_EXPOSED=false'
  exit 0
fi
http_code="$(curl -sS \
  -o /tmp/wbrent-contract-check.pdf \
  -w '%{http_code}' \
  -H "Authorization: Bearer $token" \
  "http://127.0.0.1:5340/api/admin/contracts/$contract_id/pdf")"
magic="$(head -c 5 /tmp/wbrent-contract-check.pdf)"
size="$(wc -c < /tmp/wbrent-contract-check.pdf | tr -d ' ')"
rm -f /tmp/wbrent-contract-check.pdf

echo 'ADMIN_LOGIN=ok'
echo "PDF_HTTP=$http_code"
echo "PDF_MAGIC=$magic"
echo "PDF_SIZE=$size"
echo 'TOKEN_EXPOSED=false'