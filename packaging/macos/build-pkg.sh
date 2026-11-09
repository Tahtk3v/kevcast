#!/usr/bin/env bash
# Builds the KevCast Server installer for macOS with a bundled Node.js runtime (run on a Mac).
#   packaging/macos/build-pkg.sh arm64|x64   → packaging-out/KevCast-Server-<ver>-mac-<arch>.pkg
# Installs to "/Library/KevCast Server", runs as a LaunchDaemon (starts at boot), stores data in
# "/Library/Application Support/KevCast" and puts a "KevCast Web Studio" shortcut on the desktop.
# PowerPoint conversion additionally needs LibreOffice and Poppler (brew install --cask libreoffice; brew install poppler).
set -euo pipefail

ARCH="${1:-arm64}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VERSION="$(node -p "require('$ROOT/package.json').version")"
OUT="$ROOT/packaging-out"
STAGE="$OUT/server-darwin-$ARCH"
WORK="$OUT/pkg-$ARCH"
mkdir -p "$OUT"

node "$ROOT/packaging/stage-server.js" --platform darwin --arch "$ARCH" --out "$STAGE"

rm -rf "$WORK"
PAYLOAD="$WORK/root"
SCRIPTS="$WORK/scripts"
mkdir -p "$PAYLOAD/Library/KevCast Server" "$PAYLOAD/Library/LaunchDaemons" "$PAYLOAD/Applications" "$SCRIPTS"
cp -R "$STAGE/app" "$STAGE/node" "$STAGE/assets" "$PAYLOAD/Library/KevCast Server/"

cat > "$PAYLOAD/Library/LaunchDaemons/com.kevcast.server.plist" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.kevcast.server</string>
  <key>ProgramArguments</key><array>
    <string>/Library/KevCast Server/node/bin/node</string>
    <string>/Library/KevCast Server/app/server/index.js</string>
  </array>
  <key>WorkingDirectory</key><string>/Library/KevCast Server/app</string>
  <key>EnvironmentVariables</key><dict>
    <key>PORT</key><string>8080</string>
    <key>KEVCAST_DATA</key><string>/Library/Application Support/KevCast</string>
    <key>HOME</key><string>/Library/Application Support/KevCast</string>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/Library/Application Support/KevCast/kevcast.log</string>
  <key>StandardErrorPath</key><string>/Library/Application Support/KevCast/kevcast.log</string>
</dict></plist>
EOF

cat > "$PAYLOAD/Applications/KevCast Web Studio.webloc" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>URL</key><string>http://localhost:8080/admin/</string></dict></plist>
EOF

cat > "$SCRIPTS/preinstall" <<'EOF'
#!/bin/sh
# Stop a running server before files are replaced (upgrade).
launchctl bootout system /Library/LaunchDaemons/com.kevcast.server.plist 2>/dev/null || true
exit 0
EOF

cat > "$SCRIPTS/postinstall" <<'EOF'
#!/bin/sh
DATA="/Library/Application Support/KevCast"
mkdir -p "$DATA"
chmod 755 "$DATA"
chown root:wheel /Library/LaunchDaemons/com.kevcast.server.plist
chmod 644 /Library/LaunchDaemons/com.kevcast.server.plist
launchctl bootstrap system /Library/LaunchDaemons/com.kevcast.server.plist 2>/dev/null || \
  launchctl load -w /Library/LaunchDaemons/com.kevcast.server.plist

# "KevCast Web Studio" shortcut on the desktop of the user who is logged in.
CONSOLE_USER=$(stat -f%Su /dev/console)
if [ -n "$CONSOLE_USER" ] && [ "$CONSOLE_USER" != "root" ]; then
  USER_HOME=$(dscl . -read "/Users/$CONSOLE_USER" NFSHomeDirectory 2>/dev/null | awk '{print $2}')
  if [ -d "$USER_HOME/Desktop" ]; then
    cp "/Applications/KevCast Web Studio.webloc" "$USER_HOME/Desktop/"
    chown "$CONSOLE_USER" "$USER_HOME/Desktop/KevCast Web Studio.webloc"
  fi
  # Open the Web Studio once the server is up.
  for i in 1 2 3 4 5 6 7 8 9 10; do
    curl -s -o /dev/null http://localhost:8080/api/session && break
    sleep 1
  done
  sudo -u "$CONSOLE_USER" open "http://localhost:8080/" 2>/dev/null || true
fi
exit 0
EOF
chmod 755 "$SCRIPTS/preinstall" "$SCRIPTS/postinstall"

PKG="$OUT/KevCast-Server-$VERSION-mac-$ARCH.pkg"
pkgbuild --root "$PAYLOAD" --scripts "$SCRIPTS" --identifier com.kevcast.server --version "$VERSION" \
  --install-location / "$PKG"
echo "Built $PKG"
