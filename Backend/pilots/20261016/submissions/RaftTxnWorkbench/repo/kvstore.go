// Copyright 2015 The etcd Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
	"bytes"
	"encoding/gob"
	"encoding/json"
	"log"
	"sync"

	"go.etcd.io/etcd/raft/v3/raftpb"
	"go.etcd.io/etcd/server/v3/etcdserver/api/snap"
)

// a key-value store backed by raft
type kvstore struct {
	proposeC    chan<- string // channel for proposing updates
	mu          sync.RWMutex
	kvStore     map[string]string // current committed key-value pairs
	snapshotter *snap.Snapshotter
	states      map[string]KeyState
	dedup       map[string]savedResult
	waiters     map[string]chan reply
	revision    uint64
	applied     uint64
}

type kv struct {
	Key string
	Val string
}

func newKVStore(snapshotter *snap.Snapshotter, proposeC chan<- string, commitC <-chan *commit, errorC <-chan error) *kvstore {
	s := &kvstore{proposeC: proposeC, kvStore: make(map[string]string), snapshotter: snapshotter}
	s.initialize()
	snapshot, err := s.loadSnapshot()
	if err != nil {
		log.Panic(err)
	}
	if snapshot != nil {
		log.Printf("loading snapshot at term %d and index %d", snapshot.Metadata.Term, snapshot.Metadata.Index)
		if err := s.recoverFromSnapshot(snapshot.Data); err != nil {
			log.Panic(err)
		}
	}
	// read commits from raft into kvStore map until error
	go s.readCommits(commitC, errorC)
	return s
}

func (s *kvstore) Lookup(key string) (string, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	v, ok := s.kvStore[key]
	return v, ok
}

func (s *kvstore) Propose(k string, v string) {
	var buf bytes.Buffer
	if err := gob.NewEncoder(&buf).Encode(kv{k, v}); err != nil {
		log.Fatal(err)
	}
	s.proposeC <- buf.String()
}

func (s *kvstore) readCommits(commitC <-chan *commit, errorC <-chan error) {
	for commit := range commitC {
		if commit == nil {
			// signaled to load snapshot
			snapshot, err := s.loadSnapshot()
			if err != nil {
				log.Panic(err)
			}
			if snapshot != nil {
				log.Printf("loading snapshot at term %d and index %d", snapshot.Metadata.Term, snapshot.Metadata.Index)
				if err := s.recoverFromSnapshot(snapshot.Data); err != nil {
					log.Panic(err)
				}
			}
			continue
		}

		if commit.snapshot != nil {
			if err := s.recoverFromSnapshot(commit.snapshot.Data); err != nil {
				log.Panic(err)
			}
			s.mu.Lock()
			if s.applied != commit.snapshot.Metadata.Index {
				log.Panic("snapshot payload/index mismatch")
			}
			s.mu.Unlock()
		} else {
			s.mu.Lock()
			for _, data := range commit.data {
				if len(data) > 0 && data[0] == '{' {
					var c command
					if err := json.Unmarshal([]byte(data), &c); err != nil {
						log.Panic(err)
					}
					r := s.applyCommand(c)
					if ch := s.waiters[c.Token]; ch != nil {
						// A repeated transport proposal must never stall application.
						select {
						case ch <- r:
						default:
						}
					}
				} else {
					var v kv
					if err := gob.NewDecoder(bytes.NewBufferString(data)).Decode(&v); err != nil {
						log.Panic(err)
					}
					s.revision++
					s.kvStore[v.Key] = v.Val
					s.states[v.Key] = KeyState{&v.Val, s.revision}
				}
			}
			if commit.index > 0 {
				s.applied = commit.index
			}
			s.mu.Unlock()
		}
		close(commit.applyDoneC)
	}
	if err, ok := <-errorC; ok {
		log.Fatal(err)
	}
}

func (s *kvstore) getSnapshot() ([]byte, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.initialize()
	return json.Marshal(stateSnapshot{1, s.applied, s.revision, s.states, s.dedup})
}

func (s *kvstore) loadSnapshot() (*raftpb.Snapshot, error) {
	snapshot, err := s.snapshotter.Load()
	if err == snap.ErrNoSnapshot {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return snapshot, nil
}

func (s *kvstore) recoverFromSnapshot(snapshot []byte) error {
	var p stateSnapshot
	if err := json.Unmarshal(snapshot, &p); err != nil {
		return err
	}
	if err := validateSnapshot(p); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.states = p.States
	s.dedup = p.Dedup
	s.revision = p.Revision
	s.applied = p.Applied
	s.kvStore = map[string]string{}
	for k, v := range s.states {
		if v.Value != nil {
			s.kvStore[k] = *v.Value
		}
	}
	s.initialize()
	return nil
}
