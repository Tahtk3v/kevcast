#!/usr/bin/env bash
# Removes the KevCast service and program files. Your content in /var/lib/kevcast is kept.
set -euo pipefail
systemctl disable --now kevcast 2>/dev/null || true
rm -f /etc/systemd/system/kevcast.service
systemctl daemon-reload
rm -rf /opt/kevcast
echo "KevCast removed. Content is still in /var/lib/kevcast (delete it yourself if you no longer need it)."
