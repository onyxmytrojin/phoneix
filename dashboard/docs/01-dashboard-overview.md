# Dashboard Implementation Guide

Vanilla HTML + CSS + JavaScript.
No framework, no build step, no dependencies.
Lives at: shubhanmehrotra.com

---

## Why Vanilla

- No npm, no webpack, no node_modules to manage on the phone
- Single HTML file can be copied straight to the phone
- Loads instantly — no bundle parsing
- The complexity is in the backend, not the frontend

---

## File Structure

```
dashboard/
├── index.html       ← single page, everything lives here
├── style.css        ← all styles
├── app.js           ← all JavaScript, API calls, DOM updates
└── docs/            ← these files
```

---

## Sections and Data Sources

### 1. Header
- Name and title (static)
- Status pill: "Server online · 3d uptime" — calls /v1/ping
- Refreshes every 30 seconds
- Green blinking dot if ping < 500ms, red if unreachable

### 2. Currently Working On
- Calls /v1/now
- Shows: project name, description, start date, tags
- Refreshes once on load (this data doesn't change second-to-second)

### 3. Server Stats ← the unique card
- Calls /v1/server every 5 seconds
- CPU usage bar (animated, like a progress bar)
- RAM: "3.2 GB used / 5.8 GB total"
- Uptime: "3d 14h 22m"
- Small label: "Google Pixel 7a · ARM64 · Debian Linux"
- Blinking green dot — proves it's live right now, not a static page

### 4. GitHub Activity
- Calls /v1/github once on load, then every 5 minutes
- Last 5 commits with repo name, message, time ago
- Top 3 languages shown as percentage bars

### 5. Projects
- Calls /v1/projects once on load
- Card per project: name, description, language, star count, last commit
- Links to GitHub repo and live demo

### 6. Skills
- Calls /v1/skills once on load
- Grouped by category
- Clean tag-style display, not bars (bars imply false precision)

### 7. API Explorer
- Shows 3-4 live API responses inline on the page
- "Try it" button per endpoint — fetches and shows raw JSON
- Links to api.shubhanmehrotra.com/docs
- Proves the API is real and working

### 8. 30-Day Availability
- Calls /v1/availability
- Grid of 30 coloured squares (like GitHub contribution graph)
- Green = 100% uptime, yellow = degraded, red = incident
- Shows I care about uptime

### 9. Footer
- "Served from a Google Pixel 7a"
- Last API response time in ms (from most recent call)
- Link to GitHub repo

---

## Auto-refresh Schedule

| Section | Refresh interval |
|---------|-----------------|
| Server stats (CPU, RAM) | 5 seconds |
| Header ping / status | 30 seconds |
| GitHub activity | 5 minutes |
| Everything else | On page load only |

---

## JavaScript Patterns

### Fetch with timeout and error handling
Every API call wraps fetch with a 5-second timeout.
If the API is unreachable, the section shows "Unavailable" — not a broken blank card.

```javascript
async function fetchWithTimeout(url, ms = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}
```

### Time ago helper
Commits and events show "2 hours ago" not raw timestamps.

### Loading states
Each card shows a skeleton placeholder while loading.
Data appears when the fetch completes.

---

## Deployment on Phone

Dashboard files go to: `/var/www/phoneix/dashboard/`
Nginx serves this directory for shubhanmehrotra.com requests.

```bash
# From laptop — copy files to phone via SSH
scp -i ~/.ssh/pixel_key dashboard/index.html shubhan@192.168.68.115:/var/www/phoneix/dashboard/
scp -i ~/.ssh/pixel_key dashboard/style.css shubhan@192.168.68.115:/var/www/phoneix/dashboard/
scp -i ~/.ssh/pixel_key dashboard/app.js shubhan@192.168.68.115:/var/www/phoneix/dashboard/
```

After deploying, visit shubhanmehrotra.com to verify.

---

## Build Order

1. `index.html` skeleton — layout only, hardcoded placeholder text
2. `style.css` — dark theme, card grid layout, responsive
3. Server stats card — wire to /v1/server, 5-second refresh
4. Header with status pill — wire to /v1/ping, 30-second refresh
5. GitHub activity section — wire to /v1/github
6. Projects section — wire to /v1/projects
7. API Explorer — fetch and render live JSON
8. Skills section
9. Availability timeline
10. Test on mobile (the phone itself, viewing its own dashboard)
11. Deploy to phone
