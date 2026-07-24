#!/bin/bash
set -euo pipefail

REPO="/var/www/phoneix"
LOG="/var/log/deploy.log"

echo "=== deploy started $(date -u +%Y-%m-%dT%H:%M:%SZ) ===" >> "$LOG"

cd "$REPO"
git fetch origin main >> "$LOG" 2>&1
git reset --hard origin/main >> "$LOG" 2>&1

supervisorctl restart phoneix >> "$LOG" 2>&1

echo "=== deploy done ===" >> "$LOG"
