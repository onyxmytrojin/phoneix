package cluster_test

import (
	"fmt"
	"testing"

	"github.com/onyxmytrojin/phoneix/cache/cluster"
)

func TestDistribution(t *testing.T) {
	r := cluster.NewRing()
	r.AddNode("node-a")
	r.AddNode("node-b")
	r.AddNode("node-c")

	counts := map[string]int{}
	const total = 10000
	for i := 0; i < total; i++ {
		counts[r.GetNode(fmt.Sprintf("key:%d", i))]++
	}

	for id, n := range counts {
		pct := float64(n) / total * 100
		t.Logf("%s: %d keys (%.1f%%)", id, n, pct)
		if pct < 20 || pct > 47 {
			t.Errorf("%s has skewed distribution: %.1f%%", id, pct)
		}
	}
}

func TestKeyMovementOnAdd(t *testing.T) {
	r := cluster.NewRing()
	r.AddNode("node-a")
	r.AddNode("node-b")
	r.AddNode("node-c")

	const total = 10000
	before := make(map[string]string, total)
	for i := 0; i < total; i++ {
		k := fmt.Sprintf("key:%d", i)
		before[k] = r.GetNode(k)
	}

	r.AddNode("node-d")

	moved := 0
	for k, old := range before {
		if r.GetNode(k) != old {
			moved++
		}
	}
	pct := float64(moved) / total * 100
	t.Logf("keys moved after adding node-d: %d / %d (%.1f%%)", moved, total, pct)
	// Adding 1 node to 3 means the new node should claim ~1/4 = 25% of keys.
	// Anything under 30% confirms consistent hashing (vs ~75% for modulo hashing).
	if pct > 30 {
		t.Errorf("too many keys moved: %.1f%% — want < 30%%", pct)
	}
}

func TestKeyMovementOnRemove(t *testing.T) {
	r := cluster.NewRing()
	r.AddNode("node-a")
	r.AddNode("node-b")
	r.AddNode("node-c")

	const total = 10000
	before := make(map[string]string, total)
	for i := 0; i < total; i++ {
		k := fmt.Sprintf("key:%d", i)
		before[k] = r.GetNode(k)
	}

	r.RemoveNode("node-c")

	wronglyMoved := 0
	for k, old := range before {
		newNode := r.GetNode(k)
		if old != "node-c" && newNode != old {
			// a key that didn't belong to the removed node shouldn't move
			wronglyMoved++
		}
	}
	if wronglyMoved > 0 {
		t.Errorf("%d keys moved that shouldn't have (only node-c's keys should move)", wronglyMoved)
	}
}

func TestReplicaNodes(t *testing.T) {
	r := cluster.NewRing()
	r.AddNode("node-a")
	r.AddNode("node-b")
	r.AddNode("node-c")

	nodes := r.GetNodes("some-key", 2)
	if len(nodes) != 2 {
		t.Fatalf("expected 2 replica nodes, got %d", len(nodes))
	}
	if nodes[0] == nodes[1] {
		t.Error("replica nodes must be distinct")
	}
}

func TestSingleNode(t *testing.T) {
	r := cluster.NewRing()
	r.AddNode("node-a")
	for i := 0; i < 100; i++ {
		if r.GetNode(fmt.Sprintf("key:%d", i)) != "node-a" {
			t.Fatal("single node should own all keys")
		}
	}
}

func TestEmptyRing(t *testing.T) {
	r := cluster.NewRing()
	if r.GetNode("anything") != "" {
		t.Error("empty ring should return empty string")
	}
}
