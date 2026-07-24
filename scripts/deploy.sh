#!/bin/bash
set -euo pipefail

REPO="/var/www/phoneix"
LOG="/var/log/deploy.log"

echo "=== deploy started $(date -u +%Y-%m-%dT%H:%M:%SZ) ===" >> "$LOG"

echo "nameserver 8.8.8.8" > /etc/resolv.conf

cd "$REPO"
git fetch origin master >> "$LOG" 2>&1
git reset --hard origin/master >> "$LOG" 2>&1

chmod +x api/start_uvicorn.sh

supervisorctl restart phoneix >> "$LOG" 2>&1

echo "=== deploy done ===" >> "$LOG"
