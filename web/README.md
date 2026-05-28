# phoneix web

Next.js 15 portfolio and live dashboard for [shubhanmehrotra.com](https://shubhanmehrotra.com).

## Pages

| Route | Description |
|-------|-------------|
| `/` | Portfolio — hero, projects, skills, experience, contact |
| `/server` | Live server stats: CPU, memory, load avg, 90-day uptime heatmap, response times |
| `/cluster` | Distributed cache dashboard: 3-node hash ring, gossip events, key browser |

## Development

```bash
npm install
npm run dev       # http://localhost:3000
```

## Build & deploy

This is a static export — it builds to `out/` and is SCP'd to the Pixel.

```bash
npm run build     # generates out/

# Deploy (see phoneix/docs/02-deployment.md for full commands)
scp -r out/. root@<pixel-ip>:/var/www/phoneix/dashboard/
ssh root@<pixel-ip> "nginx -s reload"
```

## Environment

The frontend calls the live API at `api.shubhanmehrotra.com`. No `.env` needed locally — API calls go directly to production.
