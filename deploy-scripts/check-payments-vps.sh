#!/bin/sh
# Stan integracji platnosci na produkcji - bez ujawniania sekretow.
set -eu

echo "--- /api/payments/config ---"
curl -s https://wb-rent.pl/api/payments/config
echo

echo "--- konfiguracja w kontenerze api (bez wartosci sekretow) ---"
docker exec wb-rent-api-1 sh -lc '
  for k in PAYMENT_PROVIDER PAYU_SANDBOX PAYU_POS_ID CONTRACT_REQUIRED_BEFORE_PAYMENT SITE_URL API_URL; do
    v=$(printenv "$k" || true)
    printf "%s=%s\n" "$k" "${v:-<brak>}"
  done
  for k in PAYU_CLIENT_ID PAYU_CLIENT_SECRET PAYU_SECOND_KEY; do
    v=$(printenv "$k" || true)
    if [ -n "$v" ]; then printf "%s=<ustawione, %s znakow>\n" "$k" "$(printf %s "$v" | wc -c | tr -d " ")"; else printf "%s=<brak>\n" "$k"; fi
  done
'

echo "--- platnosci w bazie ---"
docker exec wb-rent-db-1 psql -U wbrent -d wbrent -tAc \
  "SELECT COALESCE(provider,'-')||' | '||status||' | '||COUNT(*) FROM payments GROUP BY provider, status ORDER BY 1;" \
  || echo "brak tabeli payments lub brak danych"

echo "--- rezerwacje wg payment_status ---"
docker exec wb-rent-db-1 psql -U wbrent -d wbrent -tAc \
  "SELECT COALESCE(payment_status,'-')||' | '||COUNT(*) FROM reservations GROUP BY payment_status ORDER BY 1;"
