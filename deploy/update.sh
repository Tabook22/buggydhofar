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
sudo systemctl restart "$SERVICE_NAME"

cd ../frontend
npm install
npm run build

sudo systemctl reload nginx
echo "Update complete."
