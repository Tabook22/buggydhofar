#!/usr/bin/env bash
# Run after git pull to rebuild and restart the app.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/buggydhofar}"
SERVICE_NAME="${SERVICE_NAME:-buggydhofar-api}"

cd "$APP_DIR"
git pull

cd backend
source .venv/bin/activate
pip install -r requirements.txt

if [[ -f .env ]] && ! grep -q '^PUBLIC_SITE_URL=' .env; then
  echo "PUBLIC_SITE_URL=https://buggydhofar.com" >> .env
  echo "Added PUBLIC_SITE_URL=https://buggydhofar.com to backend/.env"
fi

sudo systemctl restart "$SERVICE_NAME"

cd ../frontend
npm install
npm run build

if [[ -f "$APP_DIR/deploy/patch-nginx-media-upload.sh" ]]; then
  sudo bash "$APP_DIR/deploy/patch-nginx-media-upload.sh"
else
  sudo systemctl reload nginx
fi
echo "Update complete."
