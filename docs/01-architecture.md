# Architecture Overview

## The Full Picture

Everything runs on one Pixel 7a.
One domain. Two products. One server.

```
Internet
    │
    ▼
Cloudflare (DNS + DDoS protection + SSL)
    │
    ▼
Cloudflare Tunnel (outbound connection from phone)
    │
    ▼
Nginx (reverse proxy on phone, port 80/443)
    │
    ├──► shubhanmehrotra.com          → dashboard/   (static HTML)
    ├──► api.shubhanmehrotra.com      → api/         (FastAPI, port 8000)
    └──► shubhanmehrotra.com/cluster  → cache/       (Go HTTP, port 9000)
```

## Part 1: API + Dashboard

```
┌─────────────────────────────────┐
│  api.shubhanmehrotra.com        │
│                                 │
│  FastAPI (port 8000)            │
│  ├── /v1/health                 │
│  ├── /v1/server  ──► /proc/*    │
│  ├── /v1/github  ──► GitHub API │
│  ├── /v1/now     ──► SQLite     │
│  └── /v1/metrics ──► log files  │
└─────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  shubhanmehrotra.com            │
│                                 │
│  Vanilla JS dashboard           │
│  Calls API endpoints            │
│  Auto-refreshes every 5-30s     │
└─────────────────────────────────┘
```

## Part 2: Distributed Cache

```
┌──────────────────────────────────────────┐
│  Three Go processes on the same phone    │
│                                          │
│  Node A (:6001) ◄──gossip──► Node B (:6002)
│       ▲                           ▲      │
│       └────────gossip─────────────┘      │
│                    ▲                     │
│               Node C (:6003)             │
│                                          │
│  Consistent hash ring distributes keys  │
│  Replication: every key on 2 nodes      │
│  Gossip detects failures in ~2 seconds  │
└──────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────┐
│  Go HTTP API (port 9000)                 │
│  Serves cluster state to dashboard      │
│  shubhanmehrotra.com/cluster            │
└──────────────────────────────────────────┘
```

## Nginx Routing

```nginx
# Static dashboard
server {
    server_name shubhanmehrotra.com;
    root /var/www/phoneix/dashboard;

    # Cluster dashboard
    location /cluster {
        proxy_pass http://localhost:9000;
    }
}

# FastAPI
server {
    server_name api.shubhanmehrotra.com;
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Data Flow: API Request

```
1. Browser requests api.shubhanmehrotra.com/v1/server
2. DNS resolves to Cloudflare
3. Cloudflare routes through tunnel to phone
4. Nginx receives, proxies to localhost:8000
5. FastAPI router handles /v1/server
6. Handler reads /proc/meminfo and /proc/stat
7. Returns JSON with CPU%, RAM, uptime
8. Response flows back through Nginx → Tunnel → Cloudflare → Browser
```

## Data Flow: Cache Request

```
1. Client sends: SET user:123 "Shubhan" TTL=3600
2. Hits any node (e.g. Node A on :6001)
3. Node A hashes "user:123" → finds position on ring → belongs to Node C
4. Node A forwards to Node C
5. Node C stores the value + replicates to Node B
6. Node C returns OK to Node A
7. Node A returns OK to client
```

## Technology Choices

| Component | Technology | Why |
|-----------|-----------|-----|
| API | Python FastAPI | Auto Swagger docs, async, familiar from work |
| Database | SQLite | Zero setup, file-based, enough for this scale |
| Dashboard | Vanilla JS | No build step, loads fast, no dependencies |
| Cache | Go | ARM64 native binary, goroutines for concurrency |
| Proxy | Nginx | Already installed, simple config |
| Process manager | tmux | Keep processes alive in proot without systemd |
| Logging | structlog (Python) | JSON logs, queryable |

## File Locations on Phone

| What | Path on phone |
|------|--------------|
| Dashboard files | /var/www/phoneix/dashboard/ |
| API process | /var/www/phoneix/api/ |
| Cache binaries | /var/www/phoneix/cache/ |
| SQLite database | /var/www/phoneix/api/db/phoneix.db |
| API logs | /var/www/phoneix/api/logs/ |
| Nginx config | /etc/nginx/sites-available/phoneix |
