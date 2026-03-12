# API Implementation Guide

FastAPI backend running on the Pixel 7a.
Lives at: api.shubhanmehrotra.com

---

## Stack

| Layer | Tool | Why |
|-------|------|-----|
| Framework | FastAPI | Auto Swagger docs, async, familiar |
| Server | Uvicorn | ASGI, works in proot without privileges |
| Database | SQLite via aiosqlite | Zero setup, file on disk |
| HTTP client | httpx | Async, needed for GitHub API calls |
| Env config | python-dotenv | Secrets from .env, never hardcoded |
| Logging | Custom JSON middleware | One JSON line per request to logs/requests.jsonl |
| Rate limiting | slowapi | Per-IP rate limit via middleware |

---

## Project Structure

```
api/
├── app/
│   ├── main.py              ← app startup, middleware, routers
│   ├── config.py            ← settings from .env
│   ├── routers/
│   │   ├── health.py        ← /v1/health, /v1/ping
│   │   ├── server.py        ← /v1/server (phone stats)
│   │   ├── github.py        ← /v1/github, /v1/projects
│   │   ├── profile.py       ← /v1/now, /v1/skills, /v1/cv, /v1/uses
│   │   ├── metrics.py       ← /v1/metrics, /v1/response-times, /v1/logs
│   │   └── discovery.py     ← /v1/stack, /v1/activity
│   ├── middleware/
│   │   ├── logging.py       ← structured request logging
│   │   ├── timing.py        ← measures duration_ms per request
│   │   └── cors.py          ← CORS allow only shubhanmehrotra.com
│   └── db/
│       ├── database.py      ← SQLite connection and init
│       └── models.py        ← table definitions
├── docs/                    ← these files
├── requirements.txt
├── .env.example             ← template, safe to commit
└── .env                     ← real secrets, never commit
```

---

## Key Patterns Used Throughout

### 1. Versioned routes
Every endpoint is under `/v1/`. The router is registered with prefix `/v1`.
When v2 is needed, add a new router. Old clients keep working.

```python
# main.py
app.include_router(health_router, prefix="/v1")
app.include_router(server_router, prefix="/v1")
```

### 2. Standard error shape
Every error across every endpoint returns the same JSON structure.
This is defined once and reused everywhere.

```python
# A custom exception handler returns this for every error:
{
  "error": "github_unavailable",
  "message": "GitHub API did not respond within 5 seconds",
  "status": 503,
  "timestamp": "2026-07-06T10:00:00Z"
}
```

### 3. Rate limiting headers
slowapi adds these to every response:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1720263600
```
Exceeding returns HTTP 429.

### 4. Cache-Control by endpoint type
```python
# Live phone data — never cache
response.headers["Cache-Control"] = "no-store"

# GitHub data — cache 5 min
response.headers["Cache-Control"] = "max-age=300"

# Static profile data — cache 1 hour
response.headers["Cache-Control"] = "max-age=3600"
```

### 5. Structured logging
Every request writes one JSON line to logs/requests.jsonl:
```json
{
  "timestamp": "2026-07-06T10:00:00Z",
  "method": "GET",
  "path": "/v1/github",
  "status": 200,
  "duration_ms": 143,
  "ip_hash": "a3f9..."
}
```
The /v1/response-times and /v1/logs endpoints read this file.

---

## Build Order

Build in this order — each step gives something working to test:

1. `app/main.py` — bare FastAPI app, no routes, just starts
2. `app/config.py` — reads GITHUB_TOKEN and API_KEY from .env
3. `app/middleware/logging.py` — log every request as JSON
4. `app/routers/health.py` — /v1/health and /v1/ping
5. `app/routers/server.py` — /v1/server reads /proc/meminfo
6. `app/db/database.py` — SQLite init, "now" table
7. `app/routers/profile.py` — /v1/now GET + POST
8. `app/routers/github.py` — /v1/github calls GitHub API
9. Rate limiting middleware
10. Remaining endpoints
11. requirements.txt locked with pip freeze

---

## Running It

```bash
# Install dependencies
pip install -r requirements.txt

# Local dev
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Production on phone — managed by supervisord (not tmux)
# Start/restart via phoneix CLI:
phoneix restart   # supervisorctl restart phoneix
phoneix deploy    # git pull + restart
```

Swagger UI available at: http://localhost:8000/docs  
After deployment: api.shubhanmehrotra.com/docs

---

## Environment Variables

```bash
# .env.example — safe to commit
GITHUB_TOKEN=           # GitHub PAT, read:user scope only
API_KEY=                # Secret key for POST /v1/now
ENVIRONMENT=production  # or development
LOG_LEVEL=INFO
RATE_LIMIT=100          # requests per minute per IP
```

See [endpoints reference](./02-endpoints.md) for full request/response shapes.
See [deployment guide](../../docs/02-deployment.md) for phone setup.
