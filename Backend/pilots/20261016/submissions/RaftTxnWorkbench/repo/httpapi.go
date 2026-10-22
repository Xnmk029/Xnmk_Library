// Copyright 2015 The etcd Authors. Licensed under the Apache License, Version 2.0.
package main

import (
	"context"
	"encoding/json"
	"go.etcd.io/etcd/raft/v3/raftpb"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type httpKVAPI struct {
	store       *kvstore
	confChangeC chan<- raftpb.ConfChange
	raft        *raftNode
	timeout     time.Duration
}

func (h *httpKVAPI) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()
	timeout := h.timeout
	if timeout == 0 {
		timeout = 1500 * time.Millisecond
	}
	ctx, cancel := context.WithTimeout(r.Context(), timeout)
	defer cancel()
	bad := func(err string) { http.Error(w, err, 400) }
	send := func(c command) (reply, bool) {
		res, err := h.store.submit(ctx, c)
		if err != nil {
			http.Error(w, "result unknown: "+err.Error(), 504)
			return reply{}, false
		}
		return res, true
	}
	write := func(res reply) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(res.Code)
		_, _ = w.Write(res.Body)
	}
	body := func() ([]byte, error) { return io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20)) }
	switch r.URL.Path {
	case "/v1/status":
		if r.Method != "GET" {
			w.WriteHeader(405)
			return
		}
		if h.raft == nil {
			w.WriteHeader(503)
			return
		}
		status := h.raft.node.Status()
		h.store.mu.RLock()
		v := map[string]interface{}{"id": h.raft.id, "leaderId": status.Lead, "term": status.Term, "appliedIndex": h.store.applied, "snapshotIndex": h.raft.diagnosticSnapshot.Load(), "installedSnapshotIndex": h.raft.installedSnapshot.Load(), "revision": h.store.revision}
		h.store.mu.RUnlock()
		write(jsonReply(v, 200))
		return
	case "/v1/debug/partition":
		if r.Method != "POST" {
			w.WriteHeader(405)
			return
		}
		if h.raft == nil {
			w.WriteHeader(503)
			return
		}
		b, err := body()
		var p struct {
			Blocked []uint64 `json:"blockedPeerIds"`
		}
		if err != nil || decodeStrict(b, &p) != nil || p.Blocked == nil {
			bad("blockedPeerIds array required")
			return
		}
		for _, id := range p.Blocked {
			if id == 0 || id > uint64(len(h.raft.peers)) || id == uint64(h.raft.id) {
				bad("invalid peer ID")
				return
			}
		}
		h.raft.setPartition(p.Blocked)
		write(jsonReply(p, 200))
		return
	case "/v1/txn":
		if r.Method != "POST" {
			w.WriteHeader(405)
			return
		}
		b, err := body()
		if err != nil {
			bad(err.Error())
			return
		}
		t, err := parseTransaction(b)
		if err != nil {
			bad(err.Error())
			return
		}
		if res, ok := send(command{Kind: "txn", Txn: t}); ok {
			write(res)
		}
		return
	case "/v1/kv":
		if r.Method != "GET" {
			w.WriteHeader(405)
			return
		}
		key := r.URL.Query().Get("key")
		if key == "" {
			bad("key required")
			return
		}
		if res, ok := send(command{Kind: "read", Key: key}); ok {
			write(res)
		}
		return
	}
	if strings.HasPrefix(r.URL.Path, "/v1/") {
		http.NotFound(w, r)
		return
	}
	key := r.RequestURI
	switch r.Method {
	case "PUT":
		b, err := body()
		if err != nil {
			bad(err.Error())
			return
		}
		v := string(b)
		t := &Transaction{RequestID: "legacy-" + uniqueToken(), Compare: []Compare{}, Success: []Operation{{Op: "put", Key: key, Value: &v}}}
		if res, ok := send(command{Kind: "txn", Txn: t}); ok {
			if res.Code != 200 {
				write(res)
				return
			}
			w.WriteHeader(204)
		}
	case "GET":
		if res, ok := send(command{Kind: "read", Key: key}); ok {
			var v ReadResponse
			if err := json.Unmarshal(res.Body, &v); err != nil {
				panic(err)
			}
			if v.Value == nil {
				http.NotFound(w, r)
			} else {
				_, _ = w.Write([]byte(*v.Value))
			}
		}
	case "POST", "DELETE":
		id, err := strconv.ParseUint(strings.TrimPrefix(key, "/"), 0, 64)
		if err != nil || id == 0 || id > maxInteger {
			bad("invalid node ID")
			return
		}
		cc := raftpb.ConfChange{NodeID: id, Type: raftpb.ConfChangeRemoveNode}
		if r.Method == "POST" {
			b, err := body()
			if err != nil {
				bad(err.Error())
				return
			}
			cc.Type = raftpb.ConfChangeAddNode
			cc.Context = b
		}
		select {
		case h.confChangeC <- cc:
			w.WriteHeader(204)
		case <-ctx.Done():
			http.Error(w, "configuration proposal timed out", 504)
		}
	default:
		w.WriteHeader(405)
	}
}
func serveHttpKVAPI(kv *kvstore, port int, confChangeC chan<- raftpb.ConfChange, errorC <-chan error) {
	srv := http.Server{Addr: ":" + strconv.Itoa(port), Handler: &httpKVAPI{store: kv, confChangeC: confChangeC}, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		if err := srv.ListenAndServe(); err != nil {
			log.Fatal(err)
		}
	}()
	if err, ok := <-errorC; ok {
		log.Fatal(err)
	}
}
