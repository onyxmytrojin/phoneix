package cluster

import (
	"bufio"
	"fmt"
	"net"
	"strings"
	"time"
)

// Router wraps the hash ring and knows how to forward commands to peers.
type Router struct {
	ring  *Ring
	peers map[string]string // nodeID → host:port
	myID  string
}

func NewRouter(myID string) *Router {
	r := &Router{
		ring:  NewRing(),
		peers: make(map[string]string),
		myID:  myID,
	}
	r.ring.AddNode(myID)
	return r
}

func (r *Router) AddPeer(nodeID, addr string) {
	r.peers[nodeID] = addr
	r.ring.AddNode(nodeID)
}

func (r *Router) RemovePeer(nodeID string) {
	delete(r.peers, nodeID)
	r.ring.RemoveNode(nodeID)
}

// OwnerOf returns the nodeID that owns key.
func (r *Router) OwnerOf(key string) string {
	return r.ring.GetNode(key)
}

// IsLocal returns true if this node owns the key.
func (r *Router) IsLocal(key string) bool {
	return r.ring.GetNode(key) == r.myID
}

// Replicas returns the replica node IDs for a key (everything after the primary).
func (r *Router) Replicas(key string) []string {
	nodes := r.ring.GetNodes(key, 2)
	if len(nodes) < 2 {
		return nil
	}
	return nodes[1:]
}

// Forward opens a TCP connection to nodeID, sends command, returns response.
// A new connection per forward is fine for now; Week 4 adds pooling.
func (r *Router) Forward(nodeID, command string) (string, error) {
	addr, ok := r.peers[nodeID]
	if !ok {
		return "", fmt.Errorf("unknown peer %q", nodeID)
	}
	conn, err := net.DialTimeout("tcp", addr, 2*time.Second)
	if err != nil {
		return "", fmt.Errorf("dial %s: %w", addr, err)
	}
	defer conn.Close()
	conn.SetDeadline(time.Now().Add(3 * time.Second))

	fmt.Fprintf(conn, "%s\r\n", command)
	scanner := bufio.NewScanner(conn)
	if scanner.Scan() {
		return strings.TrimSpace(scanner.Text()), nil
	}
	if err := scanner.Err(); err != nil {
		return "", err
	}
	return "", fmt.Errorf("no response from %s", nodeID)
}

// PeerAddrs returns a snapshot of known peers for INFO/CLUSTER output.
func (r *Router) PeerAddrs() map[string]string {
	out := make(map[string]string, len(r.peers))
	for id, addr := range r.peers {
		out[id] = addr
	}
	return out
}

func (r *Router) Ring() *Ring { return r.ring }
