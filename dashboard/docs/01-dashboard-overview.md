# Dashboard Implementation Guide

Vanilla HTML + CSS + JavaScript. Two pages.
No framework, no build step, no dependencies.

---

## Why Vanilla

- No npm, no webpack, no node_modules to manage on the phone
- Files are served directly by nginx as static assets
- Loads instantly — no bundle parsing
- The complexity is in the backend, not the frontend

---

## File Structure

```
dashboard/
├── index.html       ← portfolio page (hero, GitHub, projects, skills, experience)
├── style.css        ← shared styles for index.html
├── app.js           ← JS for index.html
├── server.html      ← server ops dashboard (stats, response times, live feed, API explorer)
├── server.css       ← styles scoped to .srv-body (dark dot-grid theme)
├── server.js        ← JS for server.html
└── docs/            ← these files
```

Cache-busting is done via `?v=N` query string on script/style tags. Bump the version in the HTML when deploying JS/CSS changes.

---

## index.html — Portfolio Page

### Sections

| Section | Data source | Refresh |
|---------|------------|---------|
| Hero (greeting, photo, links) | `/v1/cv`, `/v1/github` (avatar) | On load |
| Server strip (CPU, uptime) | `/v1/server` | Every 10s |
| Currently Building | `/v1/now` | On load |
| GitHub Activity | `/v1/github` | On load, then every 5min |
| Projects | `/v1/projects` | On load |
| Skills | Static HTML | — |
| Experience / Education | Static HTML (tabs) | — |
| Contact | Static HTML | — |

### Server Strip

Slim bar between hero and "Currently Building". Shows live CPU% and uptime with a "Live" pill. Links to server.html.

```html
<div class="server-strip">
  <span id="strip-pill" ...></span>
  <span class="strip-hw">Google Pixel 7a · ARM64</span>
  <span class="strip-stats" id="strip-stats"></span>
  <a href="server.html">View server dashboard →</a>
</div>
```

---

## server.html — Server Ops Dashboard

Audience: anyone curious about how the server works, or to demo the ops side of the project.

### Sections

| Section | Data source | Refresh |
|---------|------------|---------|
| Hero (uptime counter) | `/v1/server` | Every 5s |
| Stat cards (CPU, RAM, Disk, Load) | `/v1/server` | Every 5s |
| 30-Day Uptime grid | `/v1/availability` | Every 5min |
| Response Times bars | `/v1/response-times` | Every 60s |
| Live Request Feed | `/v1/logs` | Every 5s |
| API Explorer (13 endpoints) | live fetch on button click | On demand |

### Response Times Format

`/v1/response-times` returns a dict keyed by path — not an array:
```json
{ "endpoints": { "/v1/ping": { "p50": 23, "p95": 123, "p99": 186, "count": 919 } } }
```
server.js converts with `Object.entries(d.endpoints).map(([path, s]) => ({path, avg: s.p50, ...}))`.

### Live Feed

`/v1/logs` returns the last 50 requests from the past hour. No auth required. server.js polls every 5s and renders color-coded rows (method + status).

---

## JavaScript Patterns

### apiFetch (app.js)
```javascript
async function apiFetch(path, timeoutMs = 6000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: controller.signal });
    clearTimeout(id);
    return res.ok ? res.json() : null;
  } catch { return null; }
}
```

### apiFetch (server.js — supports text format for Prometheus)
```javascript
async function apiFetch(path, { timeout = 8000, format = 'json' } = {}) {
  ...
  return format === 'text' ? res.text() : res.json();
}
```

### Time ago helper
Both pages have `timeAgo(isoStr)` — converts ISO timestamp to "4s ago", "2m ago", etc.

---

## Auto-Refresh Schedule

### index.html (app.js)
| Function | Interval |
|----------|----------|
| updateServerStrip | 10s |
| updateStatusPill | 30s |
| updateGithub | 5min |

### server.html (server.js)
| Function | Interval |
|----------|----------|
| updateStats + updateFeed | 5s |
| updateStatusPill | 30s |
| updateResponseTimes | 60s |
| updateAvailability | 5min |

---

## Theme

Both pages support light/dark toggle. Theme is stored in `localStorage.theme`. Dark mode adds `dark` class to `<body>`. server.html also has `.srv-body` class — server.css is scoped to it so styles don't bleed into index.html.

---

## Deployment

```bash
# On laptop — push to GitHub
git add dashboard/
git commit -m "update dashboard"
git push

# On phone (via SSH or Termux) — pull and restart API
phoneix deploy
```

nginx serves the dashboard directory as static files — no restart needed for HTML/CSS/JS changes, just `git pull`. API restart is only needed for Python changes.
