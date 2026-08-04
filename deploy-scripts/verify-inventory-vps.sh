#!/bin/sh
set -eu

APP_DIR="${APP_DIR:-/opt/wb-rent}"
BASE_URL="${BASE_URL:-http://127.0.0.1:5340/api/admin}"
CREDENTIALS_FILE="$APP_DIR/.initial-admin-credentials"
PRODUCT_ID="inventory-smoke-test"
COMPOSE="docker compose -f $APP_DIR/docker-compose.yml -f $APP_DIR/docker-compose.vps.yml"

password="$(sed -n 's/^Password: //p' "$CREDENTIALS_FILE")"
login="$(curl -fsS -H 'Content-Type: application/json' --data "{\"password\":\"$password\"}" "$BASE_URL/login")"
token="$(printf '%s' "$login" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')"
if [ -z "$token" ]; then
  echo 'INVENTORY_ADMIN_LOGIN=failed'
  exit 1
fi

cleanup() {
  curl -sS -X DELETE -H "Authorization: Bearer $token" "$BASE_URL/products/$PRODUCT_ID" >/dev/null || true
}
trap cleanup EXIT INT TERM
cleanup

create_payload='{
  "id":"inventory-smoke-test",
  "name":"Produkt kontrolny magazynu",
  "description":"",
  "categoryId":"pozostale",
  "image":"/favicon.svg",
  "pricePerDay":10,
  "priceNextDay":10,
  "priceWeekend":20,
  "totalQuantity":2,
  "serviceQuantity":1,
  "conditionStatus":"service",
  "inventoryNotes":"Automatyczny test powdrozeniowy",
  "isActive":false
}'
curl -fsS -X POST \
  -H "Authorization: Bearer $token" \
  -H 'Content-Type: application/json' \
  --data "$create_payload" \
  "$BASE_URL/products" >/dev/null

update_payload='{
  "id":"inventory-smoke-test",
  "name":"Produkt kontrolny magazynu",
  "description":"",
  "categoryId":"pozostale",
  "image":"/favicon.svg",
  "pricePerDay":10,
  "priceNextDay":10,
  "priceWeekend":20,
  "totalQuantity":3,
  "serviceQuantity":1,
  "conditionStatus":"attention",
  "inventoryNotes":"Automatyczny test powdrozeniowy",
  "isActive":false
}'
curl -fsS -X PUT \
  -H "Authorization: Bearer $token" \
  -H 'Content-Type: application/json' \
  --data "$update_payload" \
  "$BASE_URL/products/$PRODUCT_ID" >/dev/null

catalog="$(curl -fsS -H "Authorization: Bearer $token" "$BASE_URL/products")"
printf '%s' "$catalog" | $COMPOSE exec -T api node -e '
  let input = "";
  process.stdin.on("data", chunk => input += chunk);
  process.stdin.on("end", () => {
    const response = JSON.parse(input);
    const product = response.data?.find(item => item.id === "inventory-smoke-test");
    if (!product || Number(product.total_quantity) !== 3 || product.condition_status !== "attention" || product.is_active !== false) {
      process.exit(1);
    }
  });
'

cleanup
remaining="$(curl -fsS -H "Authorization: Bearer $token" "$BASE_URL/products")"
printf '%s' "$remaining" | $COMPOSE exec -T api node -e '
  let input = "";
  process.stdin.on("data", chunk => input += chunk);
  process.stdin.on("end", () => {
    const response = JSON.parse(input);
    if (response.data?.some(item => item.id === "inventory-smoke-test")) process.exit(1);
  });
'

echo 'INVENTORY_ADMIN_LOGIN=ok'
echo 'INVENTORY_CREATE_UPDATE_DELETE=ok'
echo 'INVENTORY_TEST_DATA_REMOVED=yes'