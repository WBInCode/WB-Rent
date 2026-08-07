#!/bin/sh
# Wlacza sandbox PayU w /opt/wb-rent/.env. Idempotentne: podmienia klucz,
# jesli juz istnieje, zamiast dopisywac duplikat.
set -eu

ENV_FILE=/opt/wb-rent/.env
[ -f "$ENV_FILE" ] || { echo "Brak $ENV_FILE" >&2; exit 1; }

cp "$ENV_FILE" "$ENV_FILE.bak-$(date +%Y%m%d-%H%M%S)"

ustaw() {
  klucz="$1"
  wartosc="$2"
  if grep -q "^${klucz}=" "$ENV_FILE"; then
    tmp=$(mktemp)
    grep -v "^${klucz}=" "$ENV_FILE" > "$tmp"
    mv "$tmp" "$ENV_FILE"
  fi
  printf '%s=%s\n' "$klucz" "$wartosc" >> "$ENV_FILE"
}

# Publiczne dane testowe PayU z dokumentacji - nie sa sekretem produkcyjnym.
ustaw PAYMENT_PROVIDER payu
ustaw PAYU_SANDBOX true
ustaw PAYU_POS_ID 300746
ustaw PAYU_SECOND_KEY b6ca15b0d1020e8094d9b5f8d163db54
ustaw PAYU_CLIENT_ID 300746
ustaw PAYU_CLIENT_SECRET 2ee86a66e5d97e3fadc400c9f19b065d

chmod 600 "$ENV_FILE"
echo "Ustawione klucze platnosci:"
grep -E '^(PAYMENT_PROVIDER|PAYU_SANDBOX|PAYU_POS_ID)=' "$ENV_FILE"
echo "PAYU_SECOND_KEY / CLIENT_SECRET: ustawione"
