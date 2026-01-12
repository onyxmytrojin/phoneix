# Distributed Cache Implementation Guide

Self-healing distributed cache in Go.
Three nodes on one phone. Redis-like API.
Lives at: shubhanmehrotra.com/cluster

---

## What It Does

```
Client → SET user:123 "Shubhan" TTL=3600
       ← OK

Client → GET user:123
       ← "Shubhan"
```

Under the hood:
- Consistent hashing routes the key to the right node
- That node stores the value + replicates to one neighbour
- If that node dies, gossip detects it in 2-3 seconds
- Traffic reroutes to the replica automatically
- Node restarts → keys rebalance back to it

---

## Why One Phone Is Fine

Three nodes = three Go processes:
```
Node A → localhost:6001
Node B → localhost:6002
Node C → localhost:6003
```

The algorithms are identical whether nodes are on different continents
or different ports on the same phone.
Docker Compose runs distributed systems this way in development.
Redis Cluster development works this way.

One-phone constraints that made the design better:
- Tuned gossip interval carefully (50ms heartbeats too noisy, 500ms right)
- Memory budget per node: 1.5GB limit so all three fit in 6GB RAM
- Had to think about what "kill a node" means when it's a process, not a machine

---

## File Structure

```
cache/
├── main.go              ← entry point, reads config, starts node
├── node/
│   ├── node.go          ← core Node struct, Start/Stop
│   ├── server.go        ← TCP listener, command parser (SET/GET/DEL)
│   ├── store.go         ← in-memory map with TTL expiry
│   └── replication.go   ← write to replica node
├── cluster/
│   ├── ring.go          ← consistent hash ring (no library)
│   ├── gossip.go        ← heartbeat sender + receiver + state machine
│   ├── membership.go    ← join/leave/rebalance
│   └── router.go        ← forward request to correct node
├── client/
│   └── client.go        ← Go client for load testing
├── dashboard/
│   └── api.go           ← HTTP endpoints for the web dashboard
├── config/
│   └── config.go        ← node ID, port, peers from flags/env
└── go.mod
```

---

## The Cache API (TCP Protocol)

```
SET key value [TTL seconds]
  → OK
  → ERR key too large

GET key
  → value
  → MISS

DEL key
  → OK

TTL key
  → 3542       (seconds remaining)
  → -1         (no TTL, lives forever)
  → MISS       (key doesn't exist)

PING
  → PONG node-a

INFO
  → JSON: { node_id, keys_held, memory_bytes, uptime_seconds, requests_total }

CLUSTER NODES
  → JSON: list of all known nodes and their status

CLUSTER RING
  → JSON: ring state for dashboard
```

---

## Consistent Hashing Ring

Not modulo hashing (`key % N`) — that reshuffles every key when nodes change.

Consistent hashing assigns each node a range on a ring (0 to 2^32).
Adding or removing a node moves only ~1/N keys.

```
Ring (0 to 2^32):

        Node A
         (0°)
    C         B
  (240°)    (120°)

"user:123" hashes to 180° → owned by Node C
```

Virtual nodes: each real node gets 150 positions on the ring.
This prevents uneven key distribution when node count is small.

Key lookup:
```
1. Hash key with FNV-1a → get position on ring
2. Walk ring clockwise until first node position
3. That node is the owner
```

---

## Gossip Protocol

Every node sends a heartbeat to every other node every 500ms.

State machine per peer:
```
ALIVE → (miss 3 heartbeats) → SUSPECT → (miss 5 total) → DEAD
DEAD  → (receives heartbeat) → ALIVE
```

When a node is marked DEAD:
- Removed from the consistent hash ring
- Its key range redistributes to remaining nodes
- Replicas of its keys become primary

```go
// Gossip loop in each node (pseudocode)
for _, peer := range knownPeers {
    go func(p Peer) {
        err := p.Ping()
        if err != nil {
            p.MissedHeartbeats++
            if p.MissedHeartbeats >= 5 {
                markDead(p)
            }
        } else {
            p.MissedHeartbeats = 0
            p.Status = ALIVE
        }
    }(peer)
}
```

---

## Replication

Every write goes to primary + one replica.

```
SET user:123 "Shubhan"
    │
    ▼
Node C (primary — owns the key range)
    │
    ├── store locally
    └── replicate to Node B (next node clockwise on ring)
            │
            └── Node B stores a copy
```

Read path:
1. Request reaches any node
2. Consistent hash → find primary
3. If primary is alive → ask primary
4. If primary is DEAD → ask replica directly

---

## Rebalancing

When a dead node recovers:
1. It sends JOIN message to any known peer
2. Peer adds it back to the ring
3. New ring is gossipped to all nodes
4. Keys that belong to the rejoined node are streamed to it
5. Old owners delete keys after transfer confirmed

Zero downtime — reads keep serving from replicas during transfer.

---

## Dashboard HTTP API

These endpoints are served by the Go HTTP server on port 9000.
The dashboard at shubhanmehrotra.com/cluster reads these.

```
GET /api/nodes        → list of all nodes, status, key count, memory
GET /api/ring         → ring state: positions, key ranges per node
GET /api/stats        → cluster-wide totals: keys, requests, hit rate
POST /api/kill/:id    → send SIGTERM to node process (demo only)
POST /api/revive/:id  → restart a killed node (demo only)
```

---

## Build Order (6 Weeks)

### Week 1 — Single Node
- Go project init, go.mod
- Config: read node ID and port from flags
- TCP server: accept connections, parse SET/GET/DEL/PING
- In-memory store: map[string]Entry, Entry has value + expiry time
- TTL: background goroutine scans and deletes expired keys
- Test: `telnet localhost 6001` → SET foo bar → GET foo → "bar"

### Week 2 — Consistent Hashing
- ring.go: implement hash ring from scratch using FNV-1a
- Virtual nodes: each real node gets 150 ring positions
- AddNode, RemoveNode, GetNode(key) methods
- Unit tests: add/remove nodes, verify < 15% key movement

### Week 3 — Multi-Node Routing
- router.go: if key belongs to another node, forward request
- Run 3 nodes locally, all aware of each other via config
- Client connects to Node A, key belongs to Node C, gets right answer
- Test: set 100 keys via Node A, verify distribution across nodes

### Week 4 — Replication
- replication.go: after local write, send to replica node
- replica = next node clockwise on ring
- Read fallback: if primary unreachable, read from replica
- TTL replicated: expiry enforced on all copies

### Week 5 — Gossip + Failure Detection
- gossip.go: 500ms heartbeat loop
- State machine: ALIVE → SUSPECT → DEAD
- Dead node removed from ring
- Traffic reroutes automatically
- Test: kill a node, verify requests succeed via replica within 3s

### Week 6 — Rebalancing + Dashboard
- membership.go: node rejoin, key streaming
- dashboard/api.go: HTTP endpoints for /api/nodes, /api/ring
- Connect to Part 1 dashboard at /cluster
- Kill Node button wired to /api/kill/:id
- End-to-end demo: kill node → watch ring update → revive → watch rebalance

---

## Interview Answer

> "I built a distributed cache from scratch in Go — consistent hashing ring
> with virtual nodes, gossip-based failure detection, replication, and live
> rebalancing. It runs as three processes on a Pixel 7a. I can show you a
> live demo where you kill a node and watch the cluster self-heal in real time
> with zero failed requests. The one-machine constraint actually forced better
> design — I had to think carefully about memory budgets and gossip timing
> instead of just throwing hardware at the problem."
