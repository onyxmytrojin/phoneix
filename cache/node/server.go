package node

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net"
	"strconv"
	"strings"
	"time"
)

type Server struct {
	nodeID string
	port   int
	store  *Store
	startedAt time.Time
	requests  uint64
}

func NewServer(nodeID string, port int) *Server {
	return &Server{
		nodeID:    nodeID,
		port:      port,
		store:     NewStore(),
		startedAt: time.Now(),
	}
}

func (s *Server) Listen() error {
	ln, err := net.Listen("tcp", fmt.Sprintf(":%d", s.port))
	if err != nil {
		return err
	}
	fmt.Printf("[%s] listening on :%d\n", s.nodeID, s.port)
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
		resp := s.dispatch(line)
		fmt.Fprintf(conn, "%s\r\n", resp)
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

	case "SET":
		// SET key value [ttl_seconds]
		if len(parts) < 3 {
			return "ERR SET key value [ttl]"
		}
		key, value := parts[1], parts[2]
		var ttl time.Duration
		if len(parts) >= 4 {
			secs, err := strconv.Atoi(parts[3])
			if err != nil || secs <= 0 {
				return "ERR invalid TTL"
			}
			ttl = time.Duration(secs) * time.Second
		}
		s.store.Set(key, value, ttl)
		return "OK"

	case "GET":
		if len(parts) < 2 {
			return "ERR GET key"
		}
		v, ok := s.store.Get(parts[1])
		if !ok {
			return "MISS"
		}
		return v

	case "DEL":
		if len(parts) < 2 {
			return "ERR DEL key"
		}
		if s.store.Del(parts[1]) {
			return "OK"
		}
		return "MISS"

	case "TTL":
		if len(parts) < 2 {
			return "ERR TTL key"
		}
		t := s.store.TTL(parts[1])
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
		}
		b, _ := json.Marshal(info)
		return string(b)

	default:
		return "ERR unknown command " + cmd
	}
}
