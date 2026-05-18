package node

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/onyxmytrojin/phoneix/cache/cluster"
	"github.com/onyxmytrojin/phoneix/cache/config"
)

// cmdLog is a fixed-size ring buffer of recent user-facing commands.
type cmdLog struct {
	mu      sync.Mutex
	entries []string
}

const maxCmdLog = 8

func (l *cmdLog) add(s string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.entries = append(l.entries, s)
	if len(l.entries) > maxCmdLog {
		l.entries = l.entries[len(l.entries)-maxCmdLog:]
	}
}

func (l *cmdLog) recent() []string {
	l.mu.Lock()
	defer l.mu.Unlock()
	if len(l.entries) == 0 {
		return nil
	}
	out := make([]string, len(l.entries))
	copy(out, l.entries)
	return out
}

type Server struct {
	nodeID    string
	port      int
	store     *Store
	router    *cluster.Router
	gossip    *cluster.Gossip
	startedAt time.Time
	requests  uint64
	userOps   atomic.Uint64 // GET + SET + DEL only
	cmdLog    *cmdLog
}

func NewServer(cfg *config.Config) *Server {
	router := cluster.NewRouter(cfg.NodeID)
	for id, addr := range cfg.Peers {
		router.AddPeer(id, addr)
	}
	s := &Server{
		nodeID:    cfg.NodeID,
		port:      cfg.Port,
		store:     NewStore(),
		router:    router,
		startedAt: time.Now(),
		cmdLog:    &cmdLog{},
	}
	if len(cfg.Peers) > 0 {
		s.gossip = cluster.NewGossip(cfg.NodeID, router)
		s.gossip.OnRecovery = func(id string) { s.migrateToRecoveredNode(id) }
		s.gossip.Start()
	}
	return s
}

func (s *Server) Listen() error {
	ln, err := net.Listen("tcp", fmt.Sprintf(":%d", s.port))
	if err != nil {
		return err
	}
	fmt.Printf("[%s] listening on :%d  peers=%v\n", s.nodeID, s.port, s.router.PeerAddrs())
	for {
		conn, err := ln.Accept()
		if err != nil {
			continue
		}
		go s.handle(conn)
	}
}

func (s *Server) handle(conn net.Conn) {
	defer conn.Close()
	scanner := bufio.NewScanner(conn)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		s.requests++
		fmt.Fprintf(conn, "%s\r\n", s.dispatch(line))
	}
}

func (s *Server) dispatch(line string) string {
	parts := strings.Fields(line)
	if len(parts) == 0 {
		return "ERR empty command"
	}
	cmd := strings.ToUpper(parts[0])

	// Log user-facing commands (skip gossip/internal noise)
	switch cmd {
	case "SET", "GET", "DEL", "MIGRATE":
		entry := line
		if len(entry) > 48 {
			entry = entry[:48] + "…"
		}
		s.cmdLog.add(entry)
	}

	switch cmd {
	case "PING":
		return "PONG " + s.nodeID

	// ── Internal replication commands ────────────────────────────────────────

	case "LOCALSET":
		if len(parts) < 3 {
			return "ERR LOCALSET key value [ttl]"
		}
		var ttl time.Duration
		if len(parts) >= 4 {
			if secs, err := strconv.Atoi(parts[3]); err == nil && secs > 0 {
				ttl = time.Duration(secs) * time.Second
			}
		}
		s.store.Set(parts[1], parts[2], ttl)
		return "OK"

	case "LOCALGET":
		if len(parts) < 2 {
			return "ERR LOCALGET key"
		}
		v, ok := s.store.Get(parts[1])
		if !ok {
			return "MISS"
		}
		return v

	case "LOCALDEL":
		if len(parts) < 2 {
			return "ERR LOCALDEL key"
		}
		s.store.Del(parts[1])
		return "OK"

	// ── Client-facing commands ────────────────────────────────────────────────

	case "SET":
		s.userOps.Add(1)
		if len(parts) < 3 {
			return "ERR SET key value [ttl]"
		}
		key := parts[1]
		if owner := s.router.OwnerOf(key); owner != s.nodeID {
			return s.forward(owner, line)
		}
		var ttl time.Duration
		if len(parts) >= 4 {
			secs, err := strconv.Atoi(parts[3])
			if err != nil || secs <= 0 {
				return "ERR invalid TTL"
			}
			ttl = time.Duration(secs) * time.Second
		}
		s.store.Set(key, parts[2], ttl)
		go s.replicate(key, parts[2], ttl, false)
		return "OK"

	case "GET":
		s.userOps.Add(1)
		if len(parts) < 2 {
			return "ERR GET key"
		}
		key := parts[1]
		owner := s.router.OwnerOf(key)
		if owner == s.nodeID {
			v, ok := s.store.Get(key)
			if ok {
				return v
			}
			if v, ok := s.readFromAnyPeer(key); ok {
				return v
			}
			return "MISS"
		}
		resp, err := s.router.Forward(owner, line)
		if err != nil {
			if v, ok := s.readFromAnyPeer(key); ok {
				return v
			}
			return "MISS"
		}
		return resp

	case "DEL":
		s.userOps.Add(1)
		if len(parts) < 2 {
			return "ERR DEL key"
		}
		key := parts[1]
		if owner := s.router.OwnerOf(key); owner != s.nodeID {
			return s.forward(owner, line)
		}
		existed := s.store.Del(key)
		go s.replicate(key, "", 0, true)
		if existed {
			return "OK"
		}
		return "MISS"

	case "TTL":
		if len(parts) < 2 {
			return "ERR TTL key"
		}
		key := parts[1]
		if owner := s.router.OwnerOf(key); owner != s.nodeID {
			return s.forward(owner, line)
		}
		t := s.store.TTL(key)
		if t == -2 {
			return "MISS"
		}
		return strconv.FormatInt(t, 10)

	case "KEYSTTL":
		// Returns JSON map of key → remaining TTL seconds for all local keys.
		all := s.store.AllWithTTL()
		b, _ := json.Marshal(all)
		return string(b)

	case "INFO":
		hits := s.store.Hits()
		misses := s.store.Misses()
		total := hits + misses
		var hitRate float64
		if total > 0 {
			hitRate = float64(hits) / float64(total) * 100
		}

		var ms runtime.MemStats
		runtime.ReadMemStats(&ms)

		uptime := int64(time.Since(s.startedAt).Seconds())
		info := map[string]any{
			"node_id":        s.nodeID,
			"port":           s.port,
			"keys_held":      s.store.Keys(),
			"uptime_seconds": uptime,
			"requests_total": s.requests,
			"user_ops":       s.userOps.Load(),
			"hits":           hits,
			"misses":         misses,
			"hit_rate":       hitRate,
			"memory_bytes":   ms.Alloc,
			"recent_cmds":    s.cmdLog.recent(),
		}
		if s.gossip != nil {
			peerInfos := s.gossip.Peers()
			peerMap := make(map[string]string, len(peerInfos))
			for _, p := range peerInfos {
				peerMap[p.ID] = p.Status
			}
			info["peer_states"] = peerMap
		}
		b, _ := json.Marshal(info)
		return string(b)

	case "CLUSTER":
		if len(parts) < 2 {
			return "ERR CLUSTER NODES|RING"
		}
		switch strings.ToUpper(parts[1]) {
		case "NODES":
			type nodeInfo struct {
				ID     string `json:"id"`
				Addr   string `json:"addr,omitempty"`
				Status string `json:"status"`
				Self   bool   `json:"self,omitempty"`
			}
			nodes := []nodeInfo{{ID: s.nodeID, Status: "alive", Self: true}}
			if s.gossip != nil {
				for _, p := range s.gossip.Peers() {
					nodes = append(nodes, nodeInfo{ID: p.ID, Addr: p.Addr, Status: p.Status})
				}
			} else {
				for id, addr := range s.router.PeerAddrs() {
					nodes = append(nodes, nodeInfo{ID: id, Addr: addr, Status: "alive"})
				}
			}
			b, _ := json.Marshal(nodes)
			return string(b)
		case "RING":
			ring := s.router.Ring()
			b, _ := json.Marshal(map[string]any{
				"nodes":         ring.Nodes(),
				"virtual_nodes": 150,
			})
			return string(b)
		default:
			return "ERR unknown CLUSTER subcommand"
		}

	case "KEYS":
		keys := make([]string, 0)
		for k := range s.store.All() {
			keys = append(keys, k)
		}
		b, _ := json.Marshal(keys)
		return string(b)

	case "MIGRATE":
		n := s.migrate()
		return fmt.Sprintf("MIGRATED:%d", n)

	default:
		return "ERR unknown command " + cmd
	}
}

func (s *Server) forward(nodeID, command string) string {
	resp, err := s.router.Forward(nodeID, command)
	if err != nil {
		return "ERR forward to " + nodeID + ": " + err.Error()
	}
	return resp
}

func (s *Server) migrate() int {
	all := s.store.All()
	moved := 0
	for key, value := range all {
		owner := s.router.OwnerOf(key)
		if owner == s.nodeID {
			continue
		}
		ttl := s.store.TTL(key)
		var cmd string
		if ttl > 0 {
			cmd = fmt.Sprintf("LOCALSET %s %s %d", key, value, ttl)
		} else {
			cmd = fmt.Sprintf("LOCALSET %s %s", key, value)
		}
		if _, err := s.router.Forward(owner, cmd); err == nil {
			s.store.Del(key)
			moved++
		}
	}
	if moved > 0 {
		fmt.Printf("[%s] migrate: moved %d keys to correct owners\n", s.nodeID, moved)
	}
	return moved
}

func (s *Server) migrateToRecoveredNode(recoveredID string) {
	all := s.store.All()
	moved := 0
	for key, value := range all {
		if s.router.OwnerOf(key) != recoveredID {
			continue
		}
		ttl := s.store.TTL(key)
		var cmd string
		if ttl > 0 {
			cmd = fmt.Sprintf("LOCALSET %s %s %d", key, value, ttl)
		} else {
			cmd = fmt.Sprintf("LOCALSET %s %s", key, value)
		}
		if _, err := s.router.Forward(recoveredID, cmd); err == nil {
			s.store.Del(key)
			moved++
		}
	}
	if moved > 0 {
		fmt.Printf("[%s] rebalance: pushed %d keys to recovered %s\n", s.nodeID, moved, recoveredID)
	}
}
