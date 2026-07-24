#!/bin/bash
set -euo pipefail

REPO="/var/www/phoneix"
LOG="/var/log/deploy.log"

echo "=== deploy started $(date -u +%Y-%m-%dT%H:%M:%SZ) ===" >> "$LOG"

# Ensure DNS works in subprocess environment
if ! grep -q "nameserver" /etc/resolv.conf 2>/dev/null; then
    echo "nameserver 8.8.8.8" > /etc/resolv.conf
fi

cd "$REPO"
git fetch origin master >> "$LOG" 2>&1
git reset --hard origin/master >> "$LOG" 2>&1

supervisorctl restart phoneix >> "$LOG" 2>&1

echo "=== deploy done ===" >> "$LOG"
