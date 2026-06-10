#!/usr/bin/env bash
# VibeNovel EC2 staging bootstrap (Task 11.5)
# Run on a FRESH Ubuntu 24.04 LTS instance — separate from Hermes.
# Usage (as root or with sudo):
#   curl -fsSL <raw-url>/bootstrap-ubuntu.sh | sudo bash
# Or copy to server and:
#   sudo bash bootstrap-ubuntu.sh
#
# Does NOT deploy app code or secrets. Operator fills .env.staging separately.

set -euo pipefail

APP_USER="${APP_USER:-vibenovel}"
APP_DIR="${APP_DIR:-/opt/vibenovel}"
ENABLE_UFW="${ENABLE_UFW:-1}"

echo "==> VibeNovel EC2 bootstrap (Mode A API staging)"
echo "    user=$APP_USER dir=$APP_DIR ufw=$ENABLE_UFW"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg git ufw fail2ban unattended-upgrades

# Docker (official convenience script)
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable docker
systemctl start docker

# Docker Compose plugin
apt-get install -y docker-compose-plugin

# Caddy
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update -y
apt-get install -y caddy

# App user + directory
if ! id "$APP_USER" &>/dev/null; then
  useradd -m -s /bin/bash "$APP_USER"
fi
usermod -aG docker "$APP_USER"
mkdir -p "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chmod 750 "$APP_DIR"

# UFW (SSH + HTTP/S only)
if [[ "$ENABLE_UFW" == "1" ]]; then
  ufw --force reset
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow OpenSSH
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
fi

systemctl enable caddy
systemctl enable fail2ban
systemctl enable unattended-upgrades

echo "==> Bootstrap complete."
echo "    Next (as $APP_USER): clone repo to $APP_DIR, create .env.staging (chmod 600), configure Caddy, docker compose up."
echo "    See docs/68-aws-ec2-api-staging-deploy-report.md"