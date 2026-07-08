#!/usr/bin/env bash
# Fix "413 Request Entity Too Large" when uploading hero videos/images.
# Run on the VPS: sudo bash /var/www/buggydhofar/deploy/patch-nginx-media-upload.sh
set -euo pipefail

DOMAIN="${DOMAIN:-buggydhofar.com}"
APP_DIR="${APP_DIR:-/var/www/buggydhofar}"
SITE="/etc/nginx/sites-available/${DOMAIN}"
LIMITS_DEST="/etc/nginx/conf.d/buggydhofar-upload-limits.conf"
LIMITS_SRC="${APP_DIR}/deploy/nginx-upload-limits.conf"

echo "==> Setting global upload limit (100 MB)"
if [[ -f "$LIMITS_SRC" ]]; then
  cp "$LIMITS_SRC" "$LIMITS_DEST"
else
  tee "$LIMITS_DEST" >/dev/null <<'EOF'
client_max_body_size 100m;
EOF
fi

if [[ -f "$SITE" ]]; then
  echo "==> Patching API proxy timeouts in ${SITE}"
  if ! grep -q 'proxy_read_timeout' "$SITE"; then
    sed -i '/location \/api\/ {/a\        proxy_read_timeout 300s;\n        proxy_send_timeout 300s;' "$SITE"
  fi
  if ! grep -q 'client_max_body_size' "$SITE"; then
    sed -i '/location \/api\/ {/a\        client_max_body_size 100m;' "$SITE"
  fi
else
  echo "WARN: ${SITE} not found — global limit in conf.d still applies."
fi

nginx -t
systemctl reload nginx
echo "Done. Nginx now accepts uploads up to 100 MB. Try your video upload again."