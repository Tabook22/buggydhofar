#!/usr/bin/env bash
# Ensure Apple Pay domain verification file is served without SPA redirects.
set -euo pipefail

DOMAIN="${DOMAIN:-buggydhofar.com}"
SITE_FILE="/etc/nginx/sites-available/${DOMAIN}"

if [[ ! -f "$SITE_FILE" ]]; then
  echo "Nginx site file not found: $SITE_FILE"
  exit 1
fi

if grep -q 'location /.well-known/' "$SITE_FILE"; then
  echo "Nginx already has /.well-known/ location."
else
  sudo sed -i '/location \/ {/i\
    location /.well-known/ {\
        try_files $uri =404;\
        default_type text/plain;\
        add_header Cache-Control "public, max-age=3600";\
    }\
' "$SITE_FILE"
  echo "Added /.well-known/ location to $SITE_FILE"
fi

sudo nginx -t
sudo systemctl reload nginx
echo "Nginx reloaded for Apple Pay domain verification."