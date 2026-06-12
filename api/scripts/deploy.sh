#!/bin/bash
set -euo pipefail

# prevent overlapping deploys
LOCK=/tmp/phoneix_deploy.lock
if [ -f "$LOCK" ]; then exit 0; fi
touch "$LOCK"
trap "rm -f $LOCK" EXIT

cd /var/www/phoneix
git pull origin master

cd web
npm install --silent
npm run build

rm -rf /var/www/phoneix/dashboard/*
cp -r out/. /var/www/phoneix/dashboard/
nginx -s reload
