#!/usr/bin/env bash
# KevCast server installer for macOS (uses Homebrew).
# Usage (from the repository folder):  ./install/macos/install.sh
set -euo pipefail

PORT="${PORT:-8080}"
SRC="$(cd "$(dirname "$0")/../.." && pwd)"
PREFIX="$HOME/Applications/KevCast"
DATA="$HOME/Library/Application Support/KevCast"
PLIST="$HOME/Library/LaunchAgents/com.kevcast.server.plist"

if ! command -v brew >/dev/null; then
  echo "==> Installing Homebrew"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || /usr/local/bin/brew shellenv)"
fi

echo "==> Installing Node.js, Poppler and LibreOffice"
brew list node >/dev/null 2>&1 || brew install node
brew list poppler >/dev/null 2>&1 || brew install poppler
[ -d /Applications/LibreOffice.app ] || brew install --cask libreoffice

echo "==> Copying KevCast to $PREFIX"
mkdir -p "$PREFIX" "$DATA"
cp -R "$SRC/server" "$SRC/shared" "$SRC/public" "$SRC/package.json" "$SRC/package-lock.json" "$PREFIX/"
(cd "$PREFIX" && npm ci --omit=dev --no-audit --no-fund)

echo "==> Registering background service"
NODE="$(command -v node)"
mkdir -p "$(dirname "$PLIST")"
cat > "$PLIST" <<P
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.kevcast.server</string>
  <key>ProgramArguments</key><array><string>$NODE</string><string>$PREFIX/server/index.js</string></array>
  <key>EnvironmentVariables</key><dict>
    <key>PORT</key><string>$PORT</string>
    <key>KEVCAST_DATA</key><string>$DATA</string>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$DATA/kevcast.log</string>
  <key>StandardErrorPath</key><string>$DATA/kevcast.log</string>
</dict></plist>
P
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

IP=$(ipconfig getifaddr en0 2>/dev/null || echo localhost)
echo
echo "  KevCast is installed and starts automatically when you log in."
echo "  Admin:   http://localhost:$PORT/admin/"
echo "  Players: http://$IP:$PORT/player/"
echo "  Log:     $DATA/kevcast.log"
open "http://localhost:$PORT/admin/" 2>/dev/null || true
