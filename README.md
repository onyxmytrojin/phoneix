# Phoneix

> A personal API, live dashboard, and self-healing distributed cache — all running on a Pixel 7a phone.

**Live:** shubhanmehrotra.com  
**API:** api.shubhanmehrotra.com  
**Cluster:** shubhanmehrotra.com/cluster  
**Server:** Google Pixel 7a · ARM64 · Debian Linux · GrapheneOS

---

## What This Is

Two things built on one phone:

**Part 1 — Personal API + Dashboard**  
A portfolio dashboard that pulls live data from the phone itself.
Server stats, GitHub activity, current projects — all real, all live.
Built with Python FastAPI + vanilla JS.

**Part 2 — Self-Healing Distributed Cache**  
A Redis-like cache built from scratch in Go.
Three nodes, consistent hashing, gossip-based failure detection,
automatic rebalancing. Live kill-a-node demo at /cluster.

---

## Structure

```
phoneix/
├── api/          FastAPI backend (Part 1)
├── dashboard/    HTML/CSS/JS frontend (Part 1)
├── cache/        Go distributed cache (Part 2)
└── docs/         Architecture and planning docs
```

## Docs

- [Architecture Overview](./docs/01-architecture.md)
- [API Implementation Guide](./api/docs/01-api-overview.md)
- [Dashboard Implementation Guide](./dashboard/docs/01-dashboard-overview.md)
- [Cache Implementation Guide](./cache/docs/01-cache-overview.md)
- [Deployment Guide](./docs/02-deployment.md)
- [Full Project Plan](./PROJECTS.md)
