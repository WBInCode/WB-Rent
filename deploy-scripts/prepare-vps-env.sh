#!/bin/sh
set -eu

APP_DIR="${APP_DIR:-/opt/wb-rent}"
SOURCE_ENV="${SOURCE_ENV:-$APP_DIR/upload/.env}"
TARGET_ENV="$APP_DIR/.env"
CREDENTIALS_FILE="$APP_DIR/.initial-admin-credentials"

read_value() {
  sed -n "s/^$1=//p" "$SOURCE_ENV" | tail -1 | sed 's/^"//;s/"$//'
}

if [ ! -f "$SOURCE_ENV" ]; then
  echo "Temporary source environment is missing" >&2
  exit 1
fi

contract_key="$(read_value CONTRACT_ENCRYPTION_KEY)"
resend_key="$(read_value RESEND_API_KEY)"
if [ "${#contract_key}" -lt 32 ] || [ "${#resend_key}" -lt 20 ]; then
  echo "Required contract encryption or Resend key is missing" >&2
  exit 1
fi

postgres_password="$(openssl rand -hex 32)"
admin_token="$(openssl rand -hex 32)"
admin_password="Aa1!$(openssl rand -hex 24)"
admin_hash="$(docker run --rm -e WB_ADMIN_PASSWORD="$admin_password" node:22-alpine node -e "const c=require('crypto');const p=process.env.WB_ADMIN_PASSWORD;const s=c.randomBytes(16);process.stdout.write('scrypt:'+s.toString('hex')+':'+c.scryptSync(p,s,64).toString('hex'))")"

umask 077
{
  printf '%s\n' 'COMPOSE_PROJECT_NAME=wb-rent'
  printf '%s\n' 'WEB_PORT=5340'
  printf 'POSTGRES_PASSWORD=%s\n' "$postgres_password"
  printf '%s\n' 'ADMIN_PASSWORD='
  printf 'ADMIN_PASSWORD_HASH=%s\n' "$admin_hash"
  printf 'ADMIN_TOKEN=%s\n' "$admin_token"
  printf '%s\n' 'ADMIN_EMAIL=kontakt@wb-rent.pl'
  printf '%s\n' 'SITE_URL=https://wb-rent.pl'
  printf '%s\n' 'API_URL=https://wb-rent.pl'
  printf '%s\n' 'CORS_ORIGIN=https://wb-rent.pl,https://www.wb-rent.pl'
  printf '%s\n' 'PAYMENT_PROVIDER=none'
  printf '%s\n' 'CONTRACTS_ENABLED=true'
  printf '%s\n' 'CONTRACT_REQUIRED_BEFORE_PAYMENT=true'
  printf 'CONTRACT_ENCRYPTION_KEY=%s\n' "$contract_key"
  printf '%s\n' 'CONTRACT_SIGNING_TTL_HOURS=24'
  printf 'RESEND_API_KEY=%s\n' "$resend_key"
  printf '%s\n' 'RESEND_FROM="WB-Rent <sklep@wb-trade.pl>"'
  printf '%s\n' 'SMTP_FROM="WB-Rent <sklep@wb-trade.pl>"'
} > "$TARGET_ENV"

{
  printf '%s\n' 'WB-Rent production admin'
  printf '%s\n' 'URL: https://wb-rent.pl/admin'
  printf 'Password: %s\n' "$admin_password"
  printf '%s\n' 'Change this password after first login, then delete this file.'
} > "$CREDENTIALS_FILE"

chmod 600 "$TARGET_ENV" "$CREDENTIALS_FILE"
rm -f "$SOURCE_ENV"

echo "Production environment generated; secrets were not printed."