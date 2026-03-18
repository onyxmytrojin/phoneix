package config

import (
	"flag"
	"strings"
)

type Config struct {
	NodeID  string
	Port    int
	Peers   []string
	MaxKeys int
}

func Load() *Config {
	id := flag.String("id", "node-a", "Node ID")
	port := flag.Int("port", 6001, "TCP port to listen on")
	peers := flag.String("peers", "", "Comma-separated peer addresses (host:port)")
	maxKeys := flag.Int("max-keys", 1000000, "Max keys per node")
	flag.Parse()

	var peerList []string
	if *peers != "" {
		for _, p := range strings.Split(*peers, ",") {
			p = strings.TrimSpace(p)
			if p != "" {
				peerList = append(peerList, p)
			}
		}
	}

	return &Config{
		NodeID:  *id,
		Port:    *port,
		Peers:   peerList,
		MaxKeys: *maxKeys,
	}
}
