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

// readFromReplica tries to read key from the replica node when the primary
// is unreachable. Returns value, found.
func (s *Server) readFromReplica(key string) (string, bool) {
	owners := s.router.Ring().GetNodes(key, 2)
	if len(owners) < 2 {
		return "", false
	}
	replicaID := owners[1]

	// If we ARE the replica, read locally.
	if replicaID == s.nodeID {
		return s.store.Get(key)
	}

	// Otherwise forward a LOCALGET to the replica (bypasses routing on their end).
	resp, err := s.router.Forward(replicaID, "LOCALGET "+key)
	if err != nil || resp == "MISS" {
		return "", false
	}
	return resp, true
}
