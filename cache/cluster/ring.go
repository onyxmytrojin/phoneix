package cluster

import (
	"fmt"
	"sort"
	"sync"
)

const virtualNodes = 150

// fnv1a hashes a string to a uint32 position on the ring.
// FNV-1a: fast, good distribution, no library needed.
func fnv1a(s string) uint32 {
	h := uint32(2166136261)
	for i := 0; i < len(s); i++ {
		h ^= uint32(s[i])
		h *= 16777619
	}
	return h
}

// Ring is a consistent hash ring. Each real node gets virtualNodes
// positions spread around the ring so key distribution stays even.
type Ring struct {
	mu        sync.RWMutex
	positions []uint32          // sorted ring positions
	nodeMap   map[uint32]string // position → nodeID
	nodes     map[string]bool   // set of live node IDs
}

func NewRing() *Ring {
	return &Ring{
		nodeMap: make(map[uint32]string),
		nodes:   make(map[string]bool),
	}
}

func (r *Ring) AddNode(nodeID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.nodes[nodeID] {
		return
	}
	r.nodes[nodeID] = true
	for i := 0; i < virtualNodes; i++ {
		pos := fnv1a(fmt.Sprintf("%s:%d", nodeID, i))
		r.positions = append(r.positions, pos)
		r.nodeMap[pos] = nodeID
	}
	sort.Slice(r.positions, func(i, j int) bool {
		return r.positions[i] < r.positions[j]
	})
}

func (r *Ring) RemoveNode(nodeID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if !r.nodes[nodeID] {
		return
	}
	delete(r.nodes, nodeID)
	kept := r.positions[:0]
	for _, pos := range r.positions {
		if r.nodeMap[pos] == nodeID {
			delete(r.nodeMap, pos)
		} else {
			kept = append(kept, pos)
		}
	}
	r.positions = kept
}

// GetNode returns the node that owns key. Walks clockwise to the
// first ring position >= hash(key), wrapping around if past the end.
func (r *Ring) GetNode(key string) string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if len(r.positions) == 0 {
		return ""
	}
	h := fnv1a(key)
	idx := sort.Search(len(r.positions), func(i int) bool {
		return r.positions[i] >= h
	})
	if idx == len(r.positions) {
		idx = 0
	}
	return r.nodeMap[r.positions[idx]]
}

// GetNodes returns up to n distinct nodes for a key — primary first,
// then replicas in clockwise order. Used for replication.
func (r *Ring) GetNodes(key string, n int) []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if len(r.positions) == 0 {
		return nil
	}
	h := fnv1a(key)
	idx := sort.Search(len(r.positions), func(i int) bool {
		return r.positions[i] >= h
	})
	if idx == len(r.positions) {
		idx = 0
	}
	seen := make(map[string]bool)
	var result []string
	for i := 0; i < len(r.positions) && len(result) < n; i++ {
		pos := r.positions[(idx+i)%len(r.positions)]
		id := r.nodeMap[pos]
		if !seen[id] {
			seen[id] = true
			result = append(result, id)
		}
	}
	return result
}

func (r *Ring) Nodes() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]string, 0, len(r.nodes))
	for id := range r.nodes {
		out = append(out, id)
	}
	return out
}

func (r *Ring) Len() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.nodes)
}
