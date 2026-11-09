#!/usr/bin/env bash
# Builds the KevCast Server .deb (Debian, Ubuntu, Raspberry Pi OS) with a bundled Node.js runtime.
#   packaging/linux/build-deb.sh amd64|arm64      → packaging-out/kevcast-server_<ver>_<arch>.deb
# Install:  sudo apt install ./kevcast-server_<ver>_<arch>.deb   (apt pulls in LibreOffice and Poppler)
set -euo pipefail

DEB_ARCH="${1:-amd64}"
case "$DEB_ARCH" in
  amd64) NODE_ARCH=x64 ;;
  arm64) NODE_ARCH=arm64 ;;
  *) echo "Unsupported architecture: $DEB_ARCH (use amd64 or arm64)" >&2; exit 1 ;;
esac

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VERSION="$(node -p "require('$ROOT/package.json').version")"
OUT="$ROOT/packaging-out"
STAGE="$OUT/server-linux-$NODE_ARCH"
PKG="$OUT/deb-$DEB_ARCH"
mkdir -p "$OUT"

node "$ROOT/packaging/stage-server.js" --platform linux --arch "$NODE_ARCH" --out "$STAGE"

rm -rf "$PKG"
install -d "$PKG/DEBIAN" "$PKG/opt/kevcast-server" "$PKG/lib/systemd/system" "$PKG/etc/default" \
  "$PKG/usr/share/applications" "$PKG/usr/share/icons/hicolor/256x256/apps" "$PKG/usr/bin" "$PKG/usr/share/doc/kevcast-server"
cp -r "$STAGE/app" "$STAGE/node" "$STAGE/assets" "$PKG/opt/kevcast-server/"
cp "$ROOT/LICENSE" "$PKG/usr/share/doc/kevcast-server/copyright"
cp "$ROOT/packaging/assets/web-studio.png" "$PKG/usr/share/icons/hicolor/256x256/apps/kevcast-web-studio.png"
cp "$ROOT/packaging/assets/server-256.png" "$PKG/usr/share/icons/hicolor/256x256/apps/kevcast-server.png"

cat > "$PKG/etc/default/kevcast" <<'EOF'
# KevCast Server settings. After changing, run: sudo systemctl restart kevcast
PORT=8080
# DISCOVERY_PORT=41234
EOF

cat > "$PKG/lib/systemd/system/kevcast.service" <<'EOF'
[Unit]
Description=KevCast narrowcasting server
After=network-online.target
Wants=network-online.target

[Service]
User=kevcast
Group=kevcast
EnvironmentFile=-/etc/default/kevcast
Environment=KEVCAST_DATA=/var/lib/kevcast
Environment=HOME=/var/lib/kevcast
WorkingDirectory=/opt/kevcast-server/app
ExecStart=/opt/kevcast-server/node/bin/node server/index.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

cat > "$PKG/usr/bin/kevcast-web-studio" <<'EOF'
#!/bin/sh
# Opens KevCast Web Studio (the admin) of the KevCast Server on this computer.
PORT=8080
[ -r /etc/default/kevcast ] && . /etc/default/kevcast
exec xdg-open "http://localhost:${PORT}/admin/"
EOF
chmod 755 "$PKG/usr/bin/kevcast-web-studio"

cat > "$PKG/usr/share/applications/kevcast-web-studio.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=KevCast Web Studio
Comment=Manage KevCast content, playlists, schedules and screens
Exec=kevcast-web-studio
Icon=kevcast-web-studio
Categories=Office;Presentation;
Terminal=false
EOF

INSTALLED_KB=$(du -sk "$PKG" | cut -f1)
cat > "$PKG/DEBIAN/control" <<EOF
Package: kevcast-server
Version: $VERSION
Architecture: $DEB_ARCH
Maintainer: Kevin B <hai@bnuy.nl>
Installed-Size: $INSTALLED_KB
Depends: adduser, poppler-utils, libreoffice-impress | libreoffice, fonts-dejavu-core
Recommends: xdg-utils, fonts-liberation2 | fonts-liberation, fonts-crosextra-carlito, fonts-crosextra-caladea
Section: web
Priority: optional
Homepage: https://github.com/tahtk3v/kevcast
Description: KevCast narrowcasting / digital signage server
 Self-hosted narrowcasting: upload PowerPoint, PDF, images and video, build
 playlists, schedule them on a visual calendar and show them on screens
 running KevCast Player or a web browser. Includes its own Node.js runtime.
EOF
echo "/etc/default/kevcast" > "$PKG/DEBIAN/conffiles"

cat > "$PKG/DEBIAN/postinst" <<'EOF'
#!/bin/sh
set -e
if [ "$1" = "configure" ]; then
  if ! getent passwd kevcast >/dev/null; then
    adduser --system --group --home /var/lib/kevcast --no-create-home --quiet kevcast
  fi
  mkdir -p /var/lib/kevcast
  chown -R kevcast:kevcast /var/lib/kevcast

  if [ -d /run/systemd/system ]; then
    systemctl daemon-reload
    systemctl enable kevcast.service >/dev/null 2>&1 || true
    systemctl restart kevcast.service || true
  fi

  PORT=8080
  [ -r /etc/default/kevcast ] && . /etc/default/kevcast
  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
    ufw allow "$PORT"/tcp >/dev/null || true
    ufw allow 41234/udp >/dev/null || true
  fi

  # Desktop shortcut to KevCast Web Studio for the user who ran the installation.
  if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
    HOME_DIR=$(getent passwd "$SUDO_USER" | cut -d: -f6)
    DESKTOP_DIR=$(su - "$SUDO_USER" -c 'xdg-user-dir DESKTOP' 2>/dev/null || echo "$HOME_DIR/Desktop")
    if [ -d "$DESKTOP_DIR" ]; then
      cp /usr/share/applications/kevcast-web-studio.desktop "$DESKTOP_DIR/"
      chown "$SUDO_USER": "$DESKTOP_DIR/kevcast-web-studio.desktop"
      chmod 755 "$DESKTOP_DIR/kevcast-web-studio.desktop"
      su - "$SUDO_USER" -c "gio set '$DESKTOP_DIR/kevcast-web-studio.desktop' metadata::trusted true" >/dev/null 2>&1 || true
    fi
  fi

  IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  echo ""
  echo "  KevCast Server is installed and running."
  echo "  Web Studio (manage):  http://${IP:-localhost}:$PORT/admin/   (or 'KevCast Web Studio' in your app menu)"
  echo "  Browser-based screens should open:  http://${IP:-localhost}:$PORT/player/"
  echo "  Settings: /etc/default/kevcast   Data: /var/lib/kevcast   Logs: journalctl -u kevcast -f"
  echo ""
fi
exit 0
EOF

cat > "$PKG/DEBIAN/prerm" <<'EOF'
#!/bin/sh
set -e
if [ -d /run/systemd/system ] && [ "$1" = "remove" ]; then
  systemctl disable --now kevcast.service >/dev/null 2>&1 || true
fi
exit 0
EOF

cat > "$PKG/DEBIAN/postrm" <<'EOF'
#!/bin/sh
set -e
[ -d /run/systemd/system ] && systemctl daemon-reload >/dev/null 2>&1 || true
if [ "$1" = "purge" ]; then
  echo "KevCast content is kept in /var/lib/kevcast (delete it yourself if you no longer need it)."
fi
exit 0
EOF
chmod 755 "$PKG/DEBIAN/postinst" "$PKG/DEBIAN/prerm" "$PKG/DEBIAN/postrm"

DEB="$OUT/kevcast-server_${VERSION}_${DEB_ARCH}.deb"
dpkg-deb --root-owner-group --build "$PKG" "$DEB" >/dev/null
echo "Built $DEB ($(du -h "$DEB" | cut -f1))"
