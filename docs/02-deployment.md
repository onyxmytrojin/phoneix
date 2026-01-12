# Deployment Guide

How to get code from this laptop onto the Pixel 7a.

---

## Prerequisites

Phone is reachable at: `192.168.68.115` (or check current IP)  
SSH key: `~/.ssh/pixel_key` (or wherever you saved it)  
Phone must be on same WiFi, or reachable via Cloudflare Tunnel.

```bash
# Test SSH connection
ssh -i ~/.ssh/pixel_key -p 8022 shubhan@192.168.68.115
```

---

## Step 1: Create Directory on Phone

SSH into the phone and create the project directory:

```bash
mkdir -p /var/www/phoneix/api
mkdir -p /var/www/phoneix/dashboard
mkdir -p /var/www/phoneix/cache
mkdir -p /var/www/phoneix/api/logs
mkdir -p /var/www/phoneix/api/db
```

---

## Step 2: Deploy the API

From the laptop, copy API files to the phone:

```bash
# Copy entire api directory
scp -i ~/.ssh/pixel_key -P 8022 -r api/app api/requirements.txt shubhan@192.168.68.115:/var/www/phoneix/api/
```

On the phone, install dependencies and start:

```bash
# Install Python dependencies
cd /var/www/phoneix/api
pip install -r requirements.txt

# Create .env file on phone (do NOT copy from laptop — set manually)
nano /var/www/phoneix/api/.env
# Add: GITHUB_TOKEN=<your token>
# Add: API_KEY=<a random secret string>
# Add: ENVIRONMENT=production

# Start in tmux so it survives SSH disconnect
tmux new -s api
uvicorn app.main:app --host 0.0.0.0 --port 8000
# Ctrl+B then D to detach
```

Verify: `curl http://localhost:8000/v1/ping` should return pong JSON.

---

## Step 3: Deploy the Dashboard

```bash
scp -i ~/.ssh/pixel_key -P 8022 dashboard/index.html dashboard/style.css dashboard/app.js shubhan@192.168.68.115:/var/www/phoneix/dashboard/
```

---

## Step 4: Configure Nginx

On the phone, create the nginx config:

```bash
nano /etc/nginx/sites-available/phoneix
```

Paste:
```nginx
# Main dashboard
server {
    listen 80;
    server_name shubhanmehrotra.com;
    root /var/www/phoneix/dashboard;
    index index.html;

    # Distributed cache dashboard
    location /cluster {
        proxy_pass http://localhost:9000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# FastAPI
server {
    listen 80;
    server_name api.shubhanmehrotra.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable and reload:
```bash
ln -s /etc/nginx/sites-available/phoneix /etc/nginx/sites-enabled/phoneix
nginx -t   # verify config is valid
nginx -s reload
```

---

## Step 5: Add api. Subdomain in Cloudflare

1. Open Cloudflare Tunnel dashboard
2. Go to your tunnel → Public Hostnames
3. Add a new hostname:
   - Subdomain: `api`
   - Domain: `shubhanmehrotra.com`
   - Service: HTTP → `localhost:8000`
4. Save

Visit `api.shubhanmehrotra.com/v1/ping` — should return JSON.

---

## Step 6: Deploy the Cache (Week 3+)

The Go cache compiles to a single binary for ARM64.
Cross-compile from the laptop:

```bash
GOOS=linux GOARCH=arm64 go build -o cache-node ./cache/main.go
```

Copy binary to phone:
```bash
scp -i ~/.ssh/pixel_key -P 8022 cache-node shubhan@192.168.68.115:/var/www/phoneix/cache/
```

Start three nodes on the phone (in tmux):
```bash
tmux new -s cache-a
/var/www/phoneix/cache/cache-node --id=node-a --port=6001 --peers=localhost:6002,localhost:6003
# Ctrl+B D

tmux new -s cache-b
/var/www/phoneix/cache/cache-node --id=node-b --port=6002 --peers=localhost:6001,localhost:6003
# Ctrl+B D

tmux new -s cache-c
/var/www/phoneix/cache/cache-node --id=node-c --port=6003 --peers=localhost:6001,localhost:6002
# Ctrl+B D
```

---

## Updating Code

Redeploy workflow (after making changes on laptop):

```bash
# API update
scp -i ~/.ssh/pixel_key -P 8022 -r api/app/ shubhan@192.168.68.115:/var/www/phoneix/api/
ssh -i ~/.ssh/pixel_key -p 8022 shubhan@192.168.68.115 "tmux send-keys -t api C-c ENTER 'uvicorn app.main:app --host 0.0.0.0 --port 8000' ENTER"

# Dashboard update
scp -i ~/.ssh/pixel_key -P 8022 dashboard/index.html dashboard/style.css dashboard/app.js shubhan@192.168.68.115:/var/www/phoneix/dashboard/

# Cache update (rebuild first)
GOOS=linux GOARCH=arm64 go build -o cache-node ./cache/main.go
scp -i ~/.ssh/pixel_key -P 8022 cache-node shubhan@192.168.68.115:/var/www/phoneix/cache/
```

---

## Checking Running Processes

```bash
# See all tmux sessions
tmux ls

# Attach to a session to see logs
tmux attach -t api

# Check if FastAPI is running
curl http://localhost:8000/v1/ping

# Check if cache nodes are running
nc -z localhost 6001 && echo "Node A up"
```
