#!/usr/bin/env bash
# Run on the VPS as root: bash 01-root-setup.sh
set -euo pipefail

APP_USER="${APP_USER:-nasser}"
APP_DIR="${APP_DIR:-/var/www/buggydhofar}"
DOMAIN="${DOMAIN:-buggydhofar.com}"

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run this script as root."
  exit 1
fi

echo "==> Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt update
apt upgrade -y

if ! id "$APP_USER" &>/dev/null; then
  echo "==> Creating user: $APP_USER"
  adduser "$APP_USER"
else
  echo "==> User $APP_USER already exists."
fi

if ! groups "$APP_USER" | grep -q '\bsudo\b'; then
  usermod -aG sudo "$APP_USER"
  echo "==> Added $APP_USER to sudo group."
fi

if [[ -d /root/.ssh && ! -f /home/$APP_USER/.ssh/authorized_keys ]]; then
  mkdir -p "/home/$APP_USER/.ssh"
  cp /root/.ssh/authorized_keys "/home/$APP_USER/.ssh/" 2>/dev/null || true
  chown -R "$APP_USER:$APP_USER" "/home/$APP_USER/.ssh"
  chmod 700 "/home/$APP_USER/.ssh"
  chmod 600 "/home/$APP_USER/.ssh/authorized_keys" 2>/dev/null || true
fi

echo "==> Installing system packages..."
apt install -y git nginx certbot python3-certbot-nginx \
  python3 python3-pip python3-venv ufw curl ca-certificates

if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  echo "==> Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi

echo "==> Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

mkdir -p "$APP_DIR"
chown "$APP_USER:$APP_USER" "$APP_DIR"

cat <<EOF

Root setup complete.

Next steps:
1. Point DNS A records for $DOMAIN and www.$DOMAIN to this server's IP.
2. Switch to the app user and run the app deploy script:

   su - $APP_USER
   cd $APP_DIR
   git clone https://github.com/Tabook22/buggydhofar.git .
   bash deploy/02-app-deploy.sh

EOF
