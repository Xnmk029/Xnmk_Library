package main

import (
	"go.etcd.io/etcd/client/pkg/v3/types"
	"net/http"
	"strconv"
	"strings"
)

// CutPeer pauses real rafthttp stream readers and sends. Process additionally
// fences messages already in a stream/pipeline when the partition changes.
func (rc *raftNode) setPartition(ids []uint64) {
	rc.partitionMu.Lock()
	defer rc.partitionMu.Unlock()
	next := map[uint64]bool{}
	for _, id := range ids {
		next[id] = true
	}
	for id := range next {
		if !rc.blocked[id] {
			rc.transport.CutPeer(types.ID(id))
		}
	}
	for id := range rc.blocked {
		if !next[id] {
			rc.transport.MendPeer(types.ID(id))
		}
	}
	rc.blocked = next
}
func (rc *raftNode) peerHandler() http.Handler {
	inner := rc.transport.Handler()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id, _ := strconv.ParseUint(r.Header.Get("X-Server-From"), 16, 64)
		if strings.HasPrefix(r.URL.Path, "/raft/stream/") {
			parts := strings.Split(r.URL.Path, "/")
			id, _ = strconv.ParseUint(parts[len(parts)-1], 16, 64)
		}
		rc.partitionMu.RLock()
		blocked := rc.blocked[id]
		rc.partitionMu.RUnlock()
		if blocked {
			http.Error(w, "peer partitioned", http.StatusServiceUnavailable)
			return
		}
		inner.ServeHTTP(w, r)
	})
}
