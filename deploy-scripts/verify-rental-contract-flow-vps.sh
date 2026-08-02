#!/bin/sh
set -eu

APP_DIR="${APP_DIR:-/opt/wb-rent}"
BASE_URL="${BASE_URL:-http://127.0.0.1:5340/api}"
COMPOSE="docker compose -f $APP_DIR/docker-compose.yml -f $APP_DIR/docker-compose.vps.yml"
CREDENTIALS_FILE="$APP_DIR/.initial-admin-credentials"
SMOKE_EMAIL="rental-flow-smoke@example.invalid"

cleanup() {
  cat <<SQL | $COMPOSE exec -T db psql -U wbrent -d wbrent >/dev/null
DELETE FROM rental_contracts
WHERE reservation_id IN (SELECT id FROM reservations WHERE email = '$SMOKE_EMAIL');
DELETE FROM reservations WHERE email = '$SMOKE_EMAIL';
SQL
}
trap cleanup EXIT INT TERM
cleanup

password="$(sed -n 's/^Password: //p' "$CREDENTIALS_FILE")"
login="$(curl -fsS -H 'Content-Type: application/json' --data "{\"password\":\"$password\"}" "$BASE_URL/admin/login")"
token="$(printf '%s' "$login" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')"
if [ -z "$token" ]; then
  echo 'RENTAL_FLOW_ADMIN_LOGIN=failed'
  exit 1
fi

reservation_payload="$(cat <<JSON
{
  "categoryId":"odkurzacze-piorace",
  "productId":"puzzi-10-1",
  "productIds":["puzzi-10-1"],
  "productName":"Odkurzacz Piorący Karcher Puzzi 10/1",
  "startDate":"2035-12-01",
  "endDate":"2035-12-02",
  "isIndefinite":false,
  "startTime":"09:00",
  "endTime":"09:00",
  "days":1,
  "delivery":false,
  "weekendPickup":false,
  "firstName":"Test",
  "lastName":"Przeplywu",
  "email":"$SMOKE_EMAIL",
  "phone":"600100200",
  "wantsInvoice":false,
  "notes":"Automatyczny test przeplywu rezerwacji i umowy",
  "totalPrice":45
}
JSON
)"
reservation="$(curl -fsS -H 'Content-Type: application/json' --data "$reservation_payload" "$BASE_URL/reservations")"
reservation_id="$(printf '%s' "$reservation" | $COMPOSE exec -T api node -e '
  let input = "";
  process.stdin.on("data", chunk => input += chunk);
  process.stdin.on("end", () => process.stdout.write(String(JSON.parse(input).id || "")));
')"
if [ -z "$reservation_id" ]; then
  echo 'RENTAL_FLOW_RESERVATION=failed'
  exit 1
fi

contract_payload="$(cat <<JSON
{
  "reservationId":$reservation_id,
  "renterAddress":"ul. Testowa 1, 00-001 Warszawa",
  "documentType":"dowod_osobisty",
  "documentNumber":"TEST 123456",
  "employeeName":"Test Automatyczny",
  "deposit":300,
  "accessories":"Standardowe wyposazenie",
  "conditionNotes":"Sprzet sprawny i kompletny"
}
JSON
)"
contract="$(curl -fsS -H "Authorization: Bearer $token" -H 'Content-Type: application/json' --data "$contract_payload" "$BASE_URL/admin/contracts")"
contract_values="$(printf '%s' "$contract" | $COMPOSE exec -T api node -e '
  let input = "";
  process.stdin.on("data", chunk => input += chunk);
  process.stdin.on("end", () => {
    const response = JSON.parse(input);
    process.stdout.write(`${response.data?.id || ""}|${response.data?.token || ""}|${response.data?.signingUrl || ""}`);
  });
')"
contract_id="$(printf '%s' "$contract_values" | cut -d'|' -f1)"
signing_token="$(printf '%s' "$contract_values" | cut -d'|' -f2)"
signing_url="$(printf '%s' "$contract_values" | cut -d'|' -f3)"
if [ -z "$contract_id" ] || [ -z "$signing_token" ] || [ -z "$signing_url" ]; then
  echo 'RENTAL_FLOW_CONTRACT=failed'
  exit 1
fi

preview="$(curl -fsS "$BASE_URL/contracts/sign/$signing_token")"
printf '%s' "$preview" | $COMPOSE exec -T api node -e '
  let input = "";
  process.stdin.on("data", chunk => input += chunk);
  process.stdin.on("end", () => {
    const response = JSON.parse(input);
    if (!response.success || response.status !== "ready" || !response.snapshot?.rental?.reservationId) process.exit(1);
  });
'

cleanup
trap - EXIT INT TERM
remaining="$(printf "SELECT COUNT(*) FROM reservations WHERE email = '$SMOKE_EMAIL';\n" | $COMPOSE exec -T db psql -U wbrent -d wbrent -tA)"
if [ "$remaining" != "0" ]; then
  echo 'RENTAL_FLOW_CLEANUP=failed'
  exit 1
fi

echo 'RENTAL_FLOW_ADMIN_LOGIN=ok'
echo 'RENTAL_FLOW_RESERVATION=ok'
echo 'RENTAL_FLOW_CONTRACT_SESSION=ok'
echo 'RENTAL_FLOW_SIGNING_PREVIEW=ok'
echo 'RENTAL_FLOW_TEST_DATA_REMOVED=yes'
