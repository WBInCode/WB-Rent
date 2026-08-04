#!/bin/sh
# Usuwa slady testu sandboxowego z prawdziwej rezerwacji.
# Testowa transakcja PayU nie jest wplata klienta, wiec rezerwacja
# musi wrocic do stanu 'unpaid'.
set -eu

SESJA="${1:?Podaj session_id platnosci testowej}"

echo "--- przed ---"
docker exec wb-rent-db-1 psql -U wbrent -d wbrent -tAc \
  "SELECT p.session_id||' | '||p.status||' | rezerwacja '||p.reservation_id||' -> '||r.payment_status
   FROM payments p JOIN reservations r ON r.id = p.reservation_id
   WHERE p.session_id = '$SESJA';"

docker exec wb-rent-db-1 psql -U wbrent -d wbrent -c \
  "BEGIN;
   UPDATE reservations SET payment_status = 'unpaid', payment_provider = NULL
   WHERE id = (SELECT reservation_id FROM payments WHERE session_id = '$SESJA');
   DELETE FROM payments WHERE session_id = '$SESJA';
   COMMIT;"

echo "--- po ---"
docker exec wb-rent-db-1 psql -U wbrent -d wbrent -tAc \
  "SELECT 'platnosci testowych: '||COUNT(*) FROM payments WHERE session_id = '$SESJA';"
docker exec wb-rent-db-1 psql -U wbrent -d wbrent -tAc \
  "SELECT payment_status||' | '||COUNT(*) FROM reservations GROUP BY payment_status ORDER BY 1;"
