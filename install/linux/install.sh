#!/usr/bin/env bash
# KevCast server installer for Debian / Ubuntu / Raspberry Pi OS / Fedora / RHEL.
# Usage (from the repository folder):  sudo ./install/linux/install.sh
set -euo pipefail

PREFIX=/opt/kevcast
DATA=/var/lib/kevcast
PORT="${PORT:-8080}"
SRC="$(cd "$(dirname "$0")/../.." && pwd)"

if [ "$(id -u)" -ne 0 ]; then echo "Please run with sudo." >&2; exit 1; fi

echo "==> Installing system packages (Node.js, LibreOffice Impress, Poppler, fonts)"
if command -v apt-get >/dev/null; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y --no-install-recommends ca-certificates curl libreoffice-impress poppler-utils \
    fonts-dejavu fonts-liberation fonts-crosextra-carlito fonts-crosextra-caladea
  if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
  fi
elif command -v dnf >/dev/null; then
  dnf install -y nodejs npm libreoffice-impress poppler-utils dejavu-sans-fonts liberation-fonts google-carlito-fonts || \
  dnf install -y nodejs npm libreoffice-impress poppler-utils
else
  echo "Unsupported distribution: install Node.js 18+, LibreOffice and poppler-utils manually, then re-run." >&2
  exit 1
fi

echo "==> Copying KevCast to $PREFIX"
id kevcast >/dev/null 2>&1 || useradd --system --home "$DATA" --shell /usr/sbin/nologin kevcast
mkdir -p "$PREFIX" "$DATA"
cp -r "$SRC/server" "$SRC/shared" "$SRC/public" "$SRC/package.json" "$SRC/package-lock.json" "$PREFIX/"
cd "$PREFIX" && npm ci --omit=dev --no-audit --no-fund
chown -R kevcast:kevcast "$DATA"

echo "==> Creating systemd service"
cat > /etc/systemd/system/kevcast.service <<UNIT
[Unit]
Description=KevCast narrowcasting server
After=network-online.target
Wants=network-online.target

[Service]
User=kevcast
Environment=PORT=$PORT
Environment=KEVCAST_DATA=$DATA
Environment=HOME=$DATA
WorkingDirectory=$PREFIX
ExecStart=$(command -v node) $PREFIX/server/index.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now kevcast

if command -v ufw >/dev/null && ufw status | grep -q active; then ufw allow "$PORT"/tcp; ufw allow 41234/udp; fi
if command -v firewall-cmd >/dev/null && firewall-cmd --state >/dev/null 2>&1; then
  firewall-cmd --permanent --add-port="$PORT"/tcp && firewall-cmd --permanent --add-port=41234/udp && firewall-cmd --reload
fi

IP=$(hostname -I 2>/dev/null | awk '{print $1}')
echo
echo "  KevCast is installed and running."
echo "  Admin:   http://${IP:-localhost}:$PORT/admin/"
echo "  Players: http://${IP:-localhost}:$PORT/player/"
echo "  Logs:    journalctl -u kevcast -f"
