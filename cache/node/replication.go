package node

import (
	"fmt"
	"time"
)

// replicate sends a LOCALSET or LOCALDEL to the replica node for key.
// Called async (go replicate(...)) so it never blocks the primary's response.
func (s *Server) replicate(key, value string, ttl time.Duration, del bool) {
	owners := s.router.Ring().GetNodes(key, 2)
	if len(owners) < 2 {
		return // single-node cluster, no replica
	}
	replicaID := owners[1]
	if replicaID == s.nodeID {
		return // we are already the replica (shouldn't happen with 3 nodes)
	}

	var cmd string
	if del {
		cmd = fmt.Sprintf("LOCALDEL %s", key)
	} else if ttl > 0 {
		cmd = fmt.Sprintf("LOCALSET %s %s %d", key, value, int(ttl.Seconds()))
	} else {
		cmd = fmt.Sprintf("LOCALSET %s %s", key, value)
	}

	if _, err := s.router.Forward(replicaID, cmd); err != nil {
		// Replica unreachable — log but don't fail the primary write.
		// Week 5 gossip will detect this and mark the node dead.
		fmt.Printf("[%s] replicate to %s failed: %v\n", s.nodeID, replicaID, err)
	}
}

// readFromAnyPeer sends LOCALGET to every live peer and returns the first hit.
// Used when the ring-determined primary doesn't hold the key — e.g. after a
// topology change where a recovered node becomes the new owner but the replica
// is on a different live node.
func (s *Server) readFromAnyPeer(key string) (string, bool) {
	// Check self first (e.g. we are the replica via a different ring position).
	if v, ok := s.store.Get(key); ok {
		return v, true
	}
	for nodeID := range s.router.PeerAddrs() {
		resp, err := s.router.Forward(nodeID, "LOCALGET "+key)
		if err == nil && resp != "MISS" {
			return resp, true
		}
	}
	return "", false
}
