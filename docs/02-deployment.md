# Deployment Guide

How to get code from this laptop onto the Pixel 7a.

---

## SSH Access

Phone is reachable at: `192.168.68.104` (check current IP if it changes — DHCP)  
SSH key: `~/.ssh/pixel_server`  
User: `root`  
Port: `22` (dropbear, running inside Debian proot)

```bash
# Test connection
ssh -i ~/.ssh/pixel_server -p 22 root@192.168.68.104
```

---

## How Deployment Works

### API (FastAPI)

Everything is managed through git. No SCP needed.

```
laptop → git push → GitHub → phoneix deploy (git pull on phone) → supervisorctl restart
```

```bash
# On laptop — push changes
git push

# On phone (via SSH or Termux) — pull and restart
phoneix deploy
```

`phoneix deploy` runs `git pull` then `supervisorctl restart phoneix` then shows status.

---

### Frontend (Next.js static export)

The web dashboard (`web/`) is built locally and SCP'd to the phone. It is **not** deployed via git pull — the `out/` build directory is gitignored.

```bash
# Build static export
cd web
npm run build          # outputs to web/out/

# Deploy to phone
ssh -i ~/.ssh/pixel_server root@192.168.68.104 "rm -rf /var/www/phoneix/dashboard/*"
scp -i ~/.ssh/pixel_server -r web/out/. root@192.168.68.104:/var/www/phoneix/dashboard/
ssh -i ~/.ssh/pixel_server root@192.168.68.104 "nginx -s reload"
```

Nginx serves `/var/www/phoneix/dashboard/` for `shubhanmehrotra.com`. The config uses:

```nginx
try_files $uri $uri/index.html $uri.html =404;
```

Note: `$uri/` (without `index.html`) must **not** be used — Next.js export creates route directories like `server/` and `cluster/` with no `index.html`, causing nginx to return 403 instead of serving the `.html` file.

---

## phoneix CLI

The `phoneix` command is at `/usr/local/bin/phoneix` on the phone.

```bash
phoneix status       # API process + nginx + cloudflared + last 5 requests
phoneix logs         # last 50 lines of uvicorn.log
phoneix follow       # tail -f uvicorn.log (live output)
phoneix errors       # grep errors/exceptions from uvicorn.log
phoneix requests     # tail -f requests.jsonl (live request stream)
phoneix restart      # supervisorctl restart phoneix
phoneix deploy       # git pull + restart
```

---

## Process Management

Supervisord manages uvicorn. Config: `/etc/supervisor/conf.d/phoneix.conf`

```bash
# Check status
supervisorctl -c /etc/supervisor/supervisord.conf status

# Restart uvicorn
supervisorctl -c /etc/supervisor/supervisord.conf restart phoneix

# View supervisord log
tail -f /var/log/supervisor/supervisord.log
```

Nginx and cloudflared are started via `/usr/local/bin/phoneix-start`, which is called from `/root/.bashrc` if not already running.

---

## Startup Flow

```
Termux opens → .bashrc runs → checks if supervisord running
                              → if not: calls phoneix-start
                                        pgrep nginx || nginx
                                        pgrep -x cloudflared || cloudflared tunnel run ...
                                        supervisord --nodaemon &
                                        supervisorctl restart phoneix
```

Supervisord runs with `--nodaemon` via nohup — daemonizing breaks proot's ptrace tracking.
Supervisord uses TCP control socket (`127.0.0.1:9001`) — AF_UNIX sockets don't work through proot.

---

## Log Files

| File | What |
|------|------|
| `/var/www/phoneix/api/logs/requests.jsonl` | Every HTTP request (JSON, one per line) |
| `/var/www/phoneix/api/logs/uvicorn.log` | Uvicorn stdout |
| `/var/www/phoneix/api/logs/uvicorn.err.log` | Errors and stack traces |
| `/var/log/supervisor/supervisord.log` | Supervisord events |
| `/var/www/phoneix/api/logs/cloudflared.log` | Cloudflare Tunnel output |

### Viewing Logs

```bash
# Rich terminal log viewer (installed via apt)
lnav /var/www/phoneix/api/logs/requests.jsonl   # JSON requests, filterable
lnav /var/www/phoneix/api/logs/uvicorn.log       # app output

# Or use phoneix CLI shortcuts
phoneix follow     # live uvicorn output
phoneix requests   # live request stream
phoneix errors     # errors only
```

---

## Environment Variables

Stored in `/var/www/phoneix/api/.env` on the phone. Never committed to git.

```bash
GITHUB_TOKEN=           # GitHub PAT, read:user scope
API_KEY=                # Secret key for authenticated endpoints
ENVIRONMENT=production
BIRTHDATE=              # Used to compute age dynamically (not in source code)
```

---

## Nginx

Config: `/etc/nginx/nginx.conf`  
Workers: 2 (reduced from auto/8 — single-user phone doesn't need more)

Routing:
- `shubhanmehrotra.com` → `/var/www/phoneix/dashboard/` (static files)
- `api.shubhanmehrotra.com` → `localhost:8000` (FastAPI)

```bash
nginx -t        # test config
nginx -s reload # reload without dropping connections
```

---

## Cloudflare Tunnel

Tunnel name: configured in `/root/.cloudflared/config.yml`  
Managed via phoneix-start — pgrep checks prevent duplicate processes accumulating.

```bash
# Check tunnel is running
pgrep -x cloudflared && echo running || echo stopped

# View tunnel log
tail -f /var/www/phoneix/api/logs/cloudflared.log
```

---

## First-Time Phone Setup (reference)

These steps are already done — here for re-setup if needed.

1. Install proot-distro in Termux: `pkg install proot-distro`
2. Install Debian: `proot-distro install debian`
3. Log in: `proot-distro login debian`
4. Install packages: `apt install nginx python3 python3-pip git dropbear supervisor lnav -y`
5. Clone repo: `git clone https://github.com/onyxmytrojin/phoneix /var/www/phoneix`
6. Create `.env` with secrets (see above)
7. Install Python deps: `pip install -r /var/www/phoneix/api/requirements.txt`
8. Configure supervisord for TCP: `inet_http_server` on `127.0.0.1:9001`
9. Set up nginx with 2 workers
10. Run phoneix-start to bring everything up
