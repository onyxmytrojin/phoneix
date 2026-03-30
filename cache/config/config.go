package config

import (
	"flag"
	"fmt"
	"strings"
)

type Config struct {
	NodeID  string
	Port    int
	Peers   map[string]string // nodeID → host:port
	MaxKeys int
}

// Load parses flags. Peers format: --peers node-b=localhost:6002,node-c=localhost:6003
func Load() *Config {
	id := flag.String("id", "node-a", "Node ID")
	port := flag.Int("port", 6001, "TCP port to listen on")
	peers := flag.String("peers", "", "Comma-separated peers: id=host:port,...")
	maxKeys := flag.Int("max-keys", 1000000, "Max keys per node")
	flag.Parse()

	peerMap := make(map[string]string)
	if *peers != "" {
		for _, p := range strings.Split(*peers, ",") {
			p = strings.TrimSpace(p)
			parts := strings.SplitN(p, "=", 2)
			if len(parts) != 2 {
				panic(fmt.Sprintf("invalid peer %q — want id=host:port", p))
			}
			peerMap[parts[0]] = parts[1]
		}
	}

	return &Config{
		NodeID:  *id,
		Port:    *port,
		Peers:   peerMap,
		MaxKeys: *maxKeys,
	}
}
