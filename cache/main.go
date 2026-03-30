package main

import (
	"fmt"
	"os"

	"github.com/onyxmytrojin/phoneix/cache/config"
	"github.com/onyxmytrojin/phoneix/cache/node"
)

func main() {
	cfg := config.Load()
	fmt.Printf("Starting Phoneix Cache — node=%s port=%d peers=%v\n",
		cfg.NodeID, cfg.Port, cfg.Peers)

	srv := node.NewServer(cfg)
	if err := srv.Listen(); err != nil {
		fmt.Fprintf(os.Stderr, "fatal: %v\n", err)
		os.Exit(1)
	}
}
