#!/bin/bash
source /var/www/phoneix/api/venv/bin/activate
cd /var/www/phoneix/api
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
