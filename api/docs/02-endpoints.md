# API Endpoints Reference

All routes are under `/v1/`. Rate limit: 100 req/min per IP.

---

## Core

### GET /
```json
{
  "name": "Phoneix API",
  "version": "1.0.0",
  "docs": "https://api.shubhanmehrotra.com/docs",
  "dashboard": "https://shubhanmehrotra.com",
  "cluster": "https://shubhanmehrotra.com/cluster"
}
```

### GET /v1/ping
Liveness check. Should respond in <10ms always.
```json
{
  "pong": true,
  "response_ms": 2,
  "timestamp": "2026-07-06T10:00:00Z"
}
```

### GET /v1/health
Deep health check — verifies real dependencies.
```json
{
  "status": "healthy",
  "checks": {
    "github_api": "reachable",
    "disk_space": "14.2GB free",
    "memory_available": "2.1GB",
    "uptime": "3d 14h 22m"
  },
  "version": "1.0.0",
  "timestamp": "2026-07-06T10:00:00Z"
}
```
If any check fails, status = "degraded" and HTTP 503.

---

## Server Stats

### GET /v1/server
Live phone metrics. Never cached.
Response headers: `Cache-Control: no-store`

```json
{
  "cpu_percent": 12.4,
  "memory": {
    "total_gb": 5.8,
    "used_gb": 3.2,
    "available_gb": 2.6,
    "percent_used": 55.2
  },
  "disk": {
    "total_gb": 128.0,
    "used_gb": 22.4,
    "free_gb": 105.6
  },
  "uptime_seconds": 302542,
  "uptime_human": "3d 12h 2m",
  "load_avg": [0.42, 0.38, 0.31],
  "hardware": "Google Pixel 7a",
  "arch": "ARM64",
  "os": "Debian Linux (proot)",
  "timestamp": "2026-07-06T10:00:00Z"
}
```

Data sources:
- CPU: `/proc/stat` (two reads, 100ms apart, calculate delta)
- Memory: `/proc/meminfo`
- Disk: `shutil.disk_usage("/")`
- Uptime: `/proc/uptime`

---

## Developer Profile

### GET /v1/now
What I'm currently working on. Stored in SQLite.
```json
{
  "project": "Phoneix",
  "description": "Personal API + distributed cache running on a Pixel 7a",
  "started": "2026-07-06",
  "tags": ["Go", "Python", "distributed-systems"],
  "updated_at": "2026-07-06T10:00:00Z"
}
```

### POST /v1/now
Update the current status. Requires API key.
```
Header: X-API-Key: <API_KEY from .env>
```
Request body:
```json
{
  "project": "Phoneix",
  "description": "Building the distributed cache",
  "started": "2026-07-06",
  "tags": ["Go", "distributed-systems"]
}
```
Returns 200 with the updated record. Returns 401 if key missing/wrong.

### GET /v1/github
Recent GitHub activity. Cached 5 minutes.
```json
{
  "username": "onyxmytrojin",
  "public_repos": 12,
  "followers": 34,
  "recent_commits": [
    {
      "repo": "phoneix",
      "message": "Add /v1/server endpoint",
      "date": "2026-07-06T08:30:00Z",
      "url": "https://github.com/onyxmytrojin/phoneix/commit/abc123"
    }
  ],
  "top_languages": ["Python", "Go", "JavaScript"],
  "profile_url": "https://github.com/onyxmytrojin"
}
```

### GET /v1/projects
My projects with live GitHub data. Cached 5 minutes.
```json
{
  "projects": [
    {
      "name": "Phoneix",
      "description": "Personal API + distributed cache on a Pixel 7a",
      "repo": "https://github.com/onyxmytrojin/phoneix",
      "live": "https://shubhanmehrotra.com",
      "stars": 12,
      "language": "Python",
      "last_commit": "2026-07-06T08:30:00Z",
      "topics": ["fastapi", "distributed-systems", "go", "self-hosted"]
    }
  ]
}
```

### GET /v1/skills
Skills by category. Cached 1 hour (rarely changes).
```json
{
  "skills": {
    "languages": ["Python", "Go", "TypeScript", "SQL", "Java", "C/C++"],
    "backend": ["FastAPI", "Django", "REST", "Microservices"],
    "cloud": ["AWS Lambda", "SQS", "ECS", "DynamoDB", "EC2"],
    "databases": ["PostgreSQL", "MySQL", "SQLite", "DynamoDB", "Redis"],
    "devops": ["Docker", "Nginx", "CI/CD", "Linux"],
    "distributed": ["Consistent Hashing", "Gossip Protocol", "Replication"]
  }
}
```

### GET /v1/cv
Full resume as structured JSON.
```json
{
  "name": "Shubhan Mehrotra",
  "title": "Software Engineer | Backend Engineer",
  "location": "Bangalore, India",
  "email": "shubhanmehrotra@gmail.com",
  "github": "github.com/onyxmytrojin",
  "linkedin": "linkedin.com/in/shubhanmehrotra",
  "experience": [...],
  "education": [...],
  "skills": {...}
}
```

### GET /v1/uses
My dev setup.
```json
{
  "hardware": "Google Pixel 7a (server), Windows laptop (dev)",
  "os": "Windows 11, Debian Linux (proot on phone)",
  "editor": "VS Code",
  "languages": ["Python", "Go"],
  "server": "Pixel 7a · ARM64 · GrapheneOS · Debian via proot-distro",
  "tunnel": "Cloudflare Tunnel",
  "proxy": "Nginx"
}
```

---

## Observability

### GET /v1/metrics
Prometheus-format text output. Scraped by dashboards.
```
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",endpoint="/v1/github",status="200"} 142

# HELP http_request_duration_ms Request duration in milliseconds
# TYPE http_request_duration_ms histogram
http_request_duration_ms_bucket{endpoint="/v1/github",le="100"} 120
```

### GET /v1/response-times
P50/P95/P99 per endpoint, last 24 hours. Computed from log file.
```json
{
  "window": "24h",
  "endpoints": {
    "/v1/github": { "p50": 89, "p95": 210, "p99": 380, "count": 142 },
    "/v1/server": { "p50": 4, "p95": 12, "p99": 18, "count": 856 },
    "/v1/health": { "p50": 45, "p95": 110, "p99": 180, "count": 88 }
  }
}
```

### GET /v1/availability
Uptime per day for last 90 days.
```json
{
  "today": { "uptime_percent": 100.0, "incidents": 0 },
  "last_7_days": { "uptime_percent": 99.8 },
  "last_30_days": { "uptime_percent": 99.5 },
  "last_90_days": { "uptime_percent": 99.1 }
}
```

### GET /v1/logs
Last 50 request logs. Requires API key.
```json
{
  "logs": [
    {
      "timestamp": "2026-07-06T10:00:00Z",
      "method": "GET",
      "path": "/v1/github",
      "status": 200,
      "duration_ms": 143,
      "ip_hash": "a3f9..."
    }
  ]
}
```

### GET /v1/visitors
Anonymous visitor count (no PII stored, just counts).
```json
{
  "today": 14,
  "this_week": 67,
  "this_month": 203,
  "all_time": 1024
}
```

---

## Discovery

### GET /v1/activity
GitHub commits + server events merged feed.
```json
{
  "feed": [
    {
      "type": "commit",
      "repo": "phoneix",
      "message": "Add rate limiting middleware",
      "timestamp": "2026-07-06T08:30:00Z"
    },
    {
      "type": "server_restart",
      "message": "Phoneix API restarted",
      "timestamp": "2026-07-05T22:00:00Z"
    }
  ]
}
```

### GET /v1/stack
Every technology used to build this.
```json
{
  "stack": [
    { "name": "FastAPI", "role": "API framework", "url": "https://fastapi.tiangolo.com" },
    { "name": "Go", "role": "Distributed cache", "url": "https://go.dev" },
    { "name": "Nginx", "role": "Reverse proxy", "url": "https://nginx.org" },
    { "name": "Cloudflare Tunnel", "role": "Public access", "url": "https://cloudflare.com" },
    { "name": "GrapheneOS", "role": "Phone OS", "url": "https://grapheneos.org" }
  ]
}
```

---

## Error Responses

All errors return this shape. HTTP status matches `status` field.

```json
{
  "error": "github_unavailable",
  "message": "GitHub API did not respond within 5 seconds",
  "status": 503,
  "timestamp": "2026-07-06T10:00:00Z"
}
```

Common error codes:

| error | status | when |
|-------|--------|------|
| `not_found` | 404 | Endpoint doesn't exist |
| `rate_limited` | 429 | Over 100 req/min |
| `unauthorized` | 401 | Missing/wrong X-API-Key |
| `github_unavailable` | 503 | GitHub API timeout |
| `internal_error` | 500 | Unexpected server error |
