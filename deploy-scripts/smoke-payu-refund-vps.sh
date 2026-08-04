#!/bin/sh
# Test zwrotu przez panel admina na opłaconej transakcji sandboxowej.
set -eu

CRED=/opt/wb-rent/.initial-admin-credentials
[ -f "$CRED" ] || { echo "Brak $CRED" >&2; exit 1; }
HASLO=$(sed -n 's/^Password: //p' "$CRED")
[ -n "$HASLO" ] || { echo "Nie odczytano hasla" >&2; exit 1; }

TOKEN=$(curl -s -X POST https://wb-rent.pl/api/admin/login \
  -H 'Content-Type: application/json' \
  -d "{\"password\":\"$HASLO\"}" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
[ -n "$TOKEN" ] || { echo "Nie udalo sie zalogowac" >&2; exit 1; }

SESJA=$(docker exec wb-rent-db-1 psql -U wbrent -d wbrent -tAc \
  "SELECT session_id FROM payments WHERE status = 'paid' ORDER BY paid_at DESC LIMIT 1;")
[ -n "$SESJA" ] || { echo "Brak oplaconej platnosci"; exit 0; }
echo "sesja: $SESJA"

echo "--- czesciowy zwrot 10 zl ---"
curl -s -X POST "https://wb-rent.pl/api/admin/payments/$SESJA/refund" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"amount":10,"reason":"Test zwrotu sandbox"}'
echo

echo "--- stan platnosci po zwrocie ---"
docker exec wb-rent-db-1 psql -U wbrent -d wbrent -tAc \
  "SELECT status||' | zwrot='||COALESCE(refund_amount::text,'-')||' zl | '||COALESCE(refund_reason,'-')||' | ext='||COALESCE(refund_external_id,'-')
   FROM payments WHERE session_id = '$SESJA';"

echo "--- rezerwacja ---"
docker exec wb-rent-db-1 psql -U wbrent -d wbrent -tAc \
  "SELECT r.id||' | '||r.payment_status FROM reservations r
   JOIN payments p ON p.reservation_id = r.id WHERE p.session_id = '$SESJA';"

echo "--- ponowny zwrot musi zostac odrzucony ---"
curl -s -X POST "https://wb-rent.pl/api/admin/payments/$SESJA/refund" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"reason":"Druga proba"}'
echo
