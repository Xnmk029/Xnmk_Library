// Copyright 2015 The etcd Authors. Licensed under the Apache License, Version 2.0.
package main

import (
	"flag"
	"fmt"
	"go.etcd.io/etcd/raft/v3/raftpb"
	"log"
	"net/http"
	"strings"
	"time"
)

func main() {
	cluster := flag.String("cluster", "http://127.0.0.1:9021", "comma separated cluster peers")
	id := flag.Int("id", 1, "node ID (position in cluster, starting at 1)")
	port := flag.Int("port", 9121, "HTTP port")
	join := flag.Bool("join", false, "join an existing cluster")
	data := flag.String("data-dir", "", "exclusive node directory (default data-ID)")
	count := flag.Uint64("snap-count", 10000, "snapshot interval in applied log entries")
	timeout := flag.Duration("request-timeout", 1500*time.Millisecond, "HTTP operation timeout")
	flag.Parse()
	peers := strings.Split(*cluster, ",")
	if *id < 1 || *id > len(peers) || *count < 1 || *count > maxInteger || *timeout <= 0 || *port < 1 || *port > 65535 {
		log.Fatal("invalid flags")
	}
	if *data == "" {
		*data = fmt.Sprintf("data-%d", *id)
	}
	proposeC := make(chan string)
	confC := make(chan raftpb.ConfChange)
	store := &kvstore{proposeC: proposeC}
	store.initialize()
	rc, commits, errs, ready := newConfiguredRaftNode(*id, peers, *join, store.getSnapshot, proposeC, confC, *data, *count, true)
	go store.readCommits(commits, errs)
	<-ready
	srv := &http.Server{Addr: fmt.Sprintf(":%d", *port), Handler: &httpKVAPI{store: store, confChangeC: confC, raft: rc, timeout: *timeout}, ReadHeaderTimeout: 5 * time.Second}
	log.Fatal(srv.ListenAndServe())
}
