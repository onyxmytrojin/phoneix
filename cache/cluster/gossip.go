package cluster

import (
	"bufio"
	"fmt"
	"net"
	"strings"
	"sync"
	"time"
)

const (
	heartbeatInterval = 2000 * time.Millisecond // 4× less traffic; still detects failures in ~6s
	deadAfter         = 3                        // missed heartbeats before marking dead
)

type NodeStatus int

const (
	StatusAlive NodeStatus = iota
	StatusSuspect
	StatusDead
)

func (s NodeStatus) String() string {
	return [...]string{"alive", "suspect", "dead"}[s]
}

type peerState struct {
	id     string
	addr   string
	status NodeStatus
	missed int
}

// PeerInfo is a public snapshot of a peer — used by dashboard and INFO.
type PeerInfo struct {
	ID     string
	Addr   string
	Status string
}

// Gossip runs a heartbeat loop every 500ms. After 3 missed heartbeats a node
// is marked dead and removed from the ring. When it recovers it's added back.
type Gossip struct {
	mu         sync.Mutex
	myID       string
	router     *Router
	peers      map[string]*peerState
	OnRecovery func(peerID string) // called (in a new goroutine) when a dead peer comes back
}

func NewGossip(myID string, router *Router) *Gossip {
	g := &Gossip{
		myID:   myID,
		router: router,
		peers:  make(map[string]*peerState),
	}
	for id, addr := range router.PeerAddrs() {
		g.peers[id] = &peerState{id: id, addr: addr, status: StatusAlive}
	}
	return g
}

// Start launches the gossip loop in the background.
func (g *Gossip) Start() {
	go g.loop()
}

func (g *Gossip) loop() {
	ticker := time.NewTicker(heartbeatInterval)
	defer ticker.Stop()
	for range ticker.C {
		g.tick()
	}
}

func (g *Gossip) tick() {
	// Snapshot without holding the lock during network I/O.
	g.mu.Lock()
	peers := make([]*peerState, 0, len(g.peers))
	for _, p := range g.peers {
		peers = append(peers, p)
	}
	g.mu.Unlock()

	var wg sync.WaitGroup
	for _, p := range peers {
		wg.Add(1)
		go func(peer *peerState) {
			defer wg.Done()
			g.pingPeer(peer)
		}(p)
	}
	wg.Wait()
}

func (g *Gossip) pingPeer(p *peerState) {
	resp, err := gossipPing(p.addr)
	alive := err == nil && strings.HasPrefix(resp, "PONG")

	g.mu.Lock()
	defer g.mu.Unlock()

	if alive {
		was := p.status
		p.missed = 0
		p.status = StatusAlive
		if was != StatusAlive {
			g.router.AddPeer(p.id, p.addr)
			fmt.Printf("[%s] gossip: %s recovered → added back to ring\n", g.myID, p.id)
			if g.OnRecovery != nil {
				go g.OnRecovery(p.id)
			}
		}
		return
	}

	p.missed++
	switch {
	case p.missed >= deadAfter && p.status != StatusDead:
		p.status = StatusDead
		g.router.RemovePeer(p.id)
		fmt.Printf("[%s] gossip: %s DEAD (missed %d) — removed from ring\n", g.myID, p.id, p.missed)
	case p.status == StatusAlive:
		p.status = StatusSuspect
		fmt.Printf("[%s] gossip: %s SUSPECT (missed %d)\n", g.myID, p.id, p.missed)
	}
}

// gossipPing opens a short-lived TCP connection and sends PING.
// Uses a 400ms timeout so the gossip loop stays within one heartbeat interval.
func gossipPing(addr string) (string, error) {
	conn, err := net.DialTimeout("tcp", addr, 400*time.Millisecond)
	if err != nil {
		return "", err
	}
	defer conn.Close()
	conn.SetDeadline(time.Now().Add(400 * time.Millisecond))
	fmt.Fprintf(conn, "PING\r\n")
	scanner := bufio.NewScanner(conn)
	if scanner.Scan() {
		return strings.TrimSpace(scanner.Text()), nil
	}
	return "", fmt.Errorf("no response")
}

// Peers returns a snapshot of all known peers with their current status.
// Includes dead nodes so the dashboard can show the full cluster picture.
func (g *Gossip) Peers() []PeerInfo {
	g.mu.Lock()
	defer g.mu.Unlock()
	out := make([]PeerInfo, 0, len(g.peers))
	for _, p := range g.peers {
		out = append(out, PeerInfo{ID: p.id, Addr: p.addr, Status: p.status.String()})
	}
	return out
}
