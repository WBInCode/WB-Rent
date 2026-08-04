#!/bin/sh
# Sprawdza, czy nowy mechanizm dopytywania bramki naprawde rozmawia z PayU.
set -eu

SESJA=$(docker exec wb-rent-db-1 psql -U wbrent -d wbrent -tAc \
  "SELECT session_id FROM payments WHERE status = 'pending' ORDER BY created_at DESC LIMIT 1;")
[ -n "$SESJA" ] || { echo "Brak platnosci w toku"; exit 0; }
echo "sesja: $SESJA"

echo "--- last_checked_at przed ---"
docker exec wb-rent-db-1 psql -U wbrent -d wbrent -tAc \
  "SELECT COALESCE(last_checked_at::text,'<nigdy>') FROM payments WHERE session_id = '$SESJA';"

echo "--- GET /api/payments/status ---"
curl -s "https://wb-rent.pl/api/payments/status/$SESJA"
echo

echo "--- last_checked_at po (zmiana = bramka odpowiedziala) ---"
docker exec wb-rent-db-1 psql -U wbrent -d wbrent -tAc \
  "SELECT COALESCE(last_checked_at::text,'<nigdy>') FROM payments WHERE session_id = '$SESJA';"

echo "--- czy w logach api sa bledy odpytywania ---"
docker logs wb-rent-api-1 --since 3m 2>&1 | grep -iE 'bramk|payu|platnosc|payment' | tail -8 || echo "(brak wpisow)"
