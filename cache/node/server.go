package node

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net"
	"strconv"
	"strings"
	"time"

	"github.com/onyxmytrojin/phoneix/cache/cluster"
	"github.com/onyxmytrojin/phoneix/cache/config"
)

type Server struct {
	nodeID    string
	port      int
	store     *Store
	router    *cluster.Router
	startedAt time.Time
	requests  uint64
}

func NewServer(cfg *config.Config) *Server {
	router := cluster.NewRouter(cfg.NodeID)
	for id, addr := range cfg.Peers {
		router.AddPeer(id, addr)
	}
	return &Server{
		nodeID:    cfg.NodeID,
		port:      cfg.Port,
		store:     NewStore(),
		router:    router,
		startedAt: time.Now(),
	}
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

	switch cmd {
	case "PING":
		return "PONG " + s.nodeID

	// ── Internal replication commands ────────────────────────────────────────
	// These bypass the ring — replicas receive them directly from the primary.

	case "LOCALSET":
		// LOCALSET key value [ttl_seconds]
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
		// LOCALGET key — read from this node's store directly, no routing
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
		go s.replicate(key, parts[2], ttl, false) // async replica write
		return "OK"

	case "GET":
		if len(parts) < 2 {
			return "ERR GET key"
		}
		key := parts[1]
		owner := s.router.OwnerOf(key)
		if owner == s.nodeID {
			v, ok := s.store.Get(key)
			if !ok {
				return "MISS"
			}
			return v
		}
		// Forward to primary; on failure fall back to replica
		resp, err := s.router.Forward(owner, line)
		if err != nil {
			if v, ok := s.readFromReplica(key); ok {
				return v
			}
			return "MISS"
		}
		return resp

	case "DEL":
		if len(parts) < 2 {
			return "ERR DEL key"
		}
		key := parts[1]
		if owner := s.router.OwnerOf(key); owner != s.nodeID {
			return s.forward(owner, line)
		}
		existed := s.store.Del(key)
		go s.replicate(key, "", 0, true) // async replica delete
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

	case "INFO":
		uptime := int64(time.Since(s.startedAt).Seconds())
		info := map[string]any{
			"node_id":        s.nodeID,
			"port":           s.port,
			"keys_held":      s.store.Keys(),
			"uptime_seconds": uptime,
			"requests_total": s.requests,
			"peers":          s.router.PeerAddrs(),
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
				ID   string `json:"id"`
				Addr string `json:"addr,omitempty"`
				Self bool   `json:"self,omitempty"`
			}
			var nodes []nodeInfo
			nodes = append(nodes, nodeInfo{ID: s.nodeID, Self: true})
			for id, addr := range s.router.PeerAddrs() {
				nodes = append(nodes, nodeInfo{ID: id, Addr: addr})
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
