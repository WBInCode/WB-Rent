#!/bin/sh
set -eu

APP_DIR="${APP_DIR:-/opt/wb-rent}"
BASE_URL="${BASE_URL:-http://127.0.0.1:5340/api}"
ADMIN_URL="$BASE_URL/admin"
CREDENTIALS_FILE="$APP_DIR/.initial-admin-credentials"
PRODUCT_ID="gallery-smoke-test"
COMPOSE="docker compose -f $APP_DIR/docker-compose.yml -f $APP_DIR/docker-compose.vps.yml"
TEMP_IMAGE="/tmp/wb-rent-gallery-smoke.png"
uploaded_url=""

password="$(sed -n 's/^Password: //p' "$CREDENTIALS_FILE")"
login="$(curl -fsS -H 'Content-Type: application/json' --data "{\"password\":\"$password\"}" "$ADMIN_URL/login")"
token="$(printf '%s' "$login" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')"
if [ -z "$token" ]; then
  echo 'GALLERY_ADMIN_LOGIN=failed'
  exit 1
fi

cleanup() {
  curl -sS -X DELETE -H "Authorization: Bearer $token" "$ADMIN_URL/products/$PRODUCT_ID" >/dev/null || true
  if [ -n "$uploaded_url" ]; then
    filename="${uploaded_url##*/}"
    curl -sS -X DELETE -H "Authorization: Bearer $token" "$ADMIN_URL/products/images/$filename" >/dev/null || true
  fi
  rm -f "$TEMP_IMAGE"
}
trap cleanup EXIT INT TERM
cleanup

printf '%s' 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' | base64 -d > "$TEMP_IMAGE"
upload_response="$(curl -fsS -X POST -H "Authorization: Bearer $token" -F "image=@$TEMP_IMAGE;type=image/png" "$ADMIN_URL/products/images")"
uploaded_url="$(printf '%s' "$upload_response" | $COMPOSE exec -T api node -e '
  let input = "";
  process.stdin.on("data", chunk => input += chunk);
  process.stdin.on("end", () => process.stdout.write(JSON.parse(input).data?.url || ""));
')"
if [ -z "$uploaded_url" ]; then
  echo 'GALLERY_UPLOAD=failed'
  exit 1
fi
curl -fsS "$BASE_URL${uploaded_url#/api}" >/dev/null

create_payload="$(printf '{\n  "id":"%s",\n  "name":"Produkt kontrolny galerii",\n  "description":"",\n  "categoryId":"pozostale",\n  "image":"/products/puzzi-10-1.jpg",\n  "images":["/products/puzzi-10-1.jpg","%s"],\n  "pricePerDay":10,\n  "priceNextDay":10,\n  "priceWeekend":20,\n  "totalQuantity":1,\n  "serviceQuantity":0,\n  "conditionStatus":"good",\n  "inventoryNotes":"Automatyczny test galerii",\n  "isActive":false\n}' "$PRODUCT_ID" "$uploaded_url")"
curl -fsS -X POST \
  -H "Authorization: Bearer $token" \
  -H 'Content-Type: application/json' \
  --data "$create_payload" \
  "$ADMIN_URL/products" >/dev/null

update_payload="$(printf '{\n  "id":"%s",\n  "name":"Produkt kontrolny galerii",\n  "description":"",\n  "categoryId":"pozostale",\n  "image":"%s",\n  "images":["%s","/products/puzzi-10-1.jpg"],\n  "pricePerDay":10,\n  "priceNextDay":10,\n  "priceWeekend":20,\n  "totalQuantity":1,\n  "serviceQuantity":0,\n  "conditionStatus":"good",\n  "inventoryNotes":"Automatyczny test galerii",\n  "isActive":false\n}' "$PRODUCT_ID" "$uploaded_url" "$uploaded_url")"
curl -fsS -X PUT \
  -H "Authorization: Bearer $token" \
  -H 'Content-Type: application/json' \
  --data "$update_payload" \
  "$ADMIN_URL/products/$PRODUCT_ID" >/dev/null

catalog="$(curl -fsS -H "Authorization: Bearer $token" "$ADMIN_URL/products")"
printf '%s' "$catalog" | $COMPOSE exec -T api node -e '
  let input = "";
  process.stdin.on("data", chunk => input += chunk);
  process.stdin.on("end", () => {
    const response = JSON.parse(input);
    const product = response.data?.find(item => item.id === "gallery-smoke-test");
    if (!product || product.images?.length !== 2 || product.images[0] !== product.image || product.images[1] !== "/products/puzzi-10-1.jpg") {
      process.exit(1);
    }
  });
'

cleanup
uploaded_url=""
remaining="$(curl -fsS -H "Authorization: Bearer $token" "$ADMIN_URL/products")"
printf '%s' "$remaining" | $COMPOSE exec -T api node -e '
  let input = "";
  process.stdin.on("data", chunk => input += chunk);
  process.stdin.on("end", () => {
    const response = JSON.parse(input);
    if (response.data?.some(item => item.id === "gallery-smoke-test")) process.exit(1);
  });
'

echo 'GALLERY_ADMIN_LOGIN=ok'
echo 'GALLERY_UPLOAD=ok'
echo 'GALLERY_ORDER_AND_PRIMARY=ok'
echo 'GALLERY_EXISTING_IMAGE_RETAINED=ok'
echo 'GALLERY_TEST_DATA_REMOVED=yes'
