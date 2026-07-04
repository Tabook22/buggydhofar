#!/usr/bin/env bash
# Run as the app user (nasser) from /var/www/buggydhofar after cloning the repo.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/buggydhofar}"
DOMAIN="${DOMAIN:-buggydhofar.com}"
REPO_URL="${REPO_URL:-https://github.com/Tabook22/buggydhofar.git}"
SERVICE_NAME="${SERVICE_NAME:-buggydhofar-api}"

if [[ ! -d "$APP_DIR/backend" || ! -d "$APP_DIR/frontend" ]]; then
  echo "Clone the repo first:"
  echo "  mkdir -p $APP_DIR && cd $APP_DIR && git clone $REPO_URL ."
  exit 1
fi

cd "$APP_DIR"

echo "==> Backend: virtualenv + dependencies"
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

if [[ ! -f .env ]]; then
  SECRET="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
  cp .env.example .env
  sed -i "s|change-this-secret-for-production|$SECRET|" .env
  echo "==> Created backend/.env with a random KHAREEF_SECRET_KEY."
  echo "    Edit backend/.env to add SMTP settings before going live."
fi

echo "==> Frontend: install + build"
cd "$APP_DIR/frontend"
npm install
npm run build

echo "==> Installing systemd service"
sudo tee "/etc/systemd/system/${SERVICE_NAME}.service" >/dev/null <<EOF
[Unit]
Description=Buggy Dhofar FastAPI API
After=network.target

[Service]
User=$(whoami)
Group=$(whoami)
WorkingDirectory=$APP_DIR/backend
EnvironmentFile=$APP_DIR/backend/.env
ExecStart=$APP_DIR/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"

echo "==> Installing Nginx site"
sudo tee "/etc/nginx/sites-available/${DOMAIN}" >/dev/null <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name buggydhofar.com www.buggydhofar.com;

    root /var/www/buggydhofar/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX

sudo ln -sf "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}"
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

echo "==> API health check"
sleep 2
curl -fsS "http://127.0.0.1:8000/api/vehicles" >/dev/null
echo "Backend OK."

cat <<EOF

App deploy complete.

Open: http://${DOMAIN}
Admin: http://${DOMAIN}/admin
Default login: admin / admin123  (change this immediately)

Enable HTTPS:
  sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}

Check services:
  sudo systemctl status ${SERVICE_NAME}
  sudo systemctl status nginx

Logs:
  journalctl -u ${SERVICE_NAME} -f
EOF
