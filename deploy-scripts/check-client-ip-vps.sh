#!/bin/sh
# Jaki adres IP widzi aplikacja za Traefikiem i nginxem.
set -eu

echo "--- IP zapisane przy podpisach umow (to widzi app) ---"
docker exec wb-rent-db-1 psql -U wbrent -d wbrent -tAc \
  "SELECT DISTINCT signed_ip FROM contracts WHERE signed_ip IS NOT NULL LIMIT 10;"

echo "--- naglowki forwardowane przez nginx ---"
docker exec wb-rent-web-1 grep -nE 'X-Forwarded-For|X-Real-IP|proxy_pass' /etc/nginx/conf.d/default.conf

echo "--- trust proxy w kodzie api ---"
docker exec wb-rent-api-1 sh -lc "grep -rn \"trust proxy\" dist/index.js || true"
