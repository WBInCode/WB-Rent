#!/bin/sh
# Smoke test platnosci: tworzy zamowienie w sandboxie PayU dla rezerwacji
# z podpisana umowa i pokazuje, co odpowiedziala bramka.
set -eu

echo "--- rezerwacje z podpisana umowa i bez platnosci ---"
docker exec wb-rent-db-1 psql -U wbrent -d wbrent -tAc \
  "SELECT r.id||'|'||r.email||'|'||r.total_price
   FROM reservations r
   JOIN rental_contracts c ON c.reservation_id = r.id AND c.status = 'signed'
   WHERE COALESCE(r.payment_status,'unpaid') <> 'paid'
     AND r.status NOT IN ('rejected','cancelled')
   ORDER BY r.id DESC LIMIT 3;"

WIERSZ=$(docker exec wb-rent-db-1 psql -U wbrent -d wbrent -tAc \
  "SELECT r.id||'|'||r.email
   FROM reservations r
   JOIN rental_contracts c ON c.reservation_id = r.id AND c.status = 'signed'
   WHERE COALESCE(r.payment_status,'unpaid') <> 'paid'
     AND r.status NOT IN ('rejected','cancelled')
   ORDER BY r.id DESC LIMIT 1;")

if [ -z "$WIERSZ" ]; then
  echo "Brak rezerwacji z podpisana umowa - nie ma na czym testowac."
  exit 0
fi

ID=$(printf '%s' "$WIERSZ" | cut -d'|' -f1)
MAIL=$(printf '%s' "$WIERSZ" | cut -d'|' -f2)
echo "--- tworze platnosc dla rezerwacji #$ID ---"

curl -s -X POST https://wb-rent.pl/api/payments/create \
  -H 'Content-Type: application/json' \
  -d "{\"reservationId\":$ID,\"email\":\"$MAIL\"}"
echo

echo "--- wiersz w bazie ---"
docker exec wb-rent-db-1 psql -U wbrent -d wbrent -tAc \
  "SELECT session_id||' | '||provider||' | '||status||' | '||amount||' zl | ext='||COALESCE(external_id,'-')
   FROM payments WHERE reservation_id = $ID ORDER BY created_at DESC LIMIT 1;"
