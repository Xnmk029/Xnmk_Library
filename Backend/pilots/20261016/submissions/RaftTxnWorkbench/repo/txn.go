package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
)

const maxInteger uint64 = 9007199254740991

type Compare struct {
	Key         string `json:"key"`
	ModRevision uint64 `json:"modRevision"`
}
type Operation struct {
	Op    string  `json:"op"`
	Key   string  `json:"key"`
	Value *string `json:"value,omitempty"`
}
type Transaction struct {
	RequestID string      `json:"requestId"`
	Compare   []Compare   `json:"compare"`
	Success   []Operation `json:"success"`
}
type KeyState struct {
	Value       *string `json:"value"`
	ModRevision uint64  `json:"modRevision"`
}
type Result struct {
	Key         string  `json:"key"`
	Value       *string `json:"value"`
	ModRevision uint64  `json:"modRevision"`
}
type TxnResponse struct {
	RequestID string   `json:"requestId"`
	Succeeded bool     `json:"succeeded"`
	Revision  uint64   `json:"revision"`
	Results   []Result `json:"results"`
}
type ReadResponse struct {
	Key         string  `json:"key"`
	Value       *string `json:"value"`
	ModRevision uint64  `json:"modRevision"`
	Revision    uint64  `json:"revision"`
}
type savedResult struct {
	Canonical string          `json:"canonical"`
	Body      json.RawMessage `json:"body"`
	Code      int             `json:"code"`
}
type command struct {
	Token string       `json:"token"`
	Kind  string       `json:"kind"`
	Txn   *Transaction `json:"txn,omitempty"`
	Key   string       `json:"key,omitempty"`
}
type reply struct {
	Body []byte
	Code int
}

func decodeStrict(data []byte, out interface{}) error {
	if err := rejectDuplicateFields(json.NewDecoder(bytes.NewReader(data))); err != nil {
		return err
	}
	d := json.NewDecoder(bytes.NewReader(data))
	d.DisallowUnknownFields()
	if err := d.Decode(out); err != nil {
		return err
	}
	if err := d.Decode(new(interface{})); err != io.EOF {
		return errors.New("expected one JSON object")
	}
	return nil
}

// JSON duplicate names are ambiguous across clients; reject them before proposing.
func rejectDuplicateFields(d *json.Decoder) error {
	t, err := d.Token()
	if err != nil {
		return err
	}
	delim, ok := t.(json.Delim)
	if !ok {
		return nil
	}
	switch delim {
	case '{':
		names := map[string]bool{}
		for d.More() {
			n, e := d.Token()
			if e != nil {
				return e
			}
			name, ok := n.(string)
			if !ok || names[name] {
				return errors.New("duplicate JSON field")
			}
			names[name] = true
			if e := rejectDuplicateFields(d); e != nil {
				return e
			}
		}
	case '[':
		for d.More() {
			if e := rejectDuplicateFields(d); e != nil {
				return e
			}
		}
	default:
		return errors.New("unexpected JSON delimiter")
	}
	_, err = d.Token()
	return err
}

func (c *Compare) UnmarshalJSON(b []byte) error {
	var v struct {
		Key      string  `json:"key"`
		Revision *uint64 `json:"modRevision"`
	}
	if err := decodeStrict(b, &v); err != nil {
		return err
	}
	if v.Revision == nil {
		return errors.New("modRevision is required")
	}
	c.Key = v.Key
	c.ModRevision = *v.Revision
	return nil
}
func parseTransaction(data []byte) (*Transaction, error) {
	var t Transaction
	if err := decodeStrict(data, &t); err != nil {
		return nil, err
	}
	if t.RequestID == "" || t.Compare == nil || len(t.Success) < 1 || len(t.Success) > 16 {
		return nil, errors.New("requestId, compare array and 1–16 success operations required")
	}
	seen := map[string]bool{}
	for _, c := range t.Compare {
		if c.Key == "" || c.ModRevision > maxInteger || seen[c.Key] {
			return nil, errors.New("invalid or repeated compare key/revision")
		}
		seen[c.Key] = true
	}
	seen = map[string]bool{}
	for _, o := range t.Success {
		if o.Key == "" || seen[o.Key] || (o.Op != "put" && o.Op != "delete") || (o.Op == "put" && o.Value == nil) || (o.Op == "delete" && o.Value != nil) {
			return nil, errors.New("invalid or repeated operation")
		}
		seen[o.Key] = true
	}
	return &t, nil
}
func uniqueToken() string {
	var b [24]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b[:])
}
func jsonReply(v interface{}, code int) reply {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return reply{b, code}
}
func (s *kvstore) submit(ctx context.Context, c command) (reply, error) {
	c.Token = uniqueToken()
	ch := make(chan reply, 1)
	s.mu.Lock()
	s.waiters[c.Token] = ch
	s.mu.Unlock()
	defer func() { s.mu.Lock(); delete(s.waiters, c.Token); s.mu.Unlock() }()
	b, err := json.Marshal(c)
	if err != nil {
		return reply{}, err
	}
	select {
	case s.proposeC <- string(b):
	case <-ctx.Done():
		return reply{}, ctx.Err()
	}
	select {
	case r := <-ch:
		return r, nil
	case <-ctx.Done():
		return reply{}, ctx.Err()
	}
}

// Called under the single state machine mutex, only for committed commands.
func (s *kvstore) applyCommand(c command) reply {
	if c.Kind == "read" {
		v := s.states[c.Key]
		return jsonReply(ReadResponse{c.Key, v.Value, v.ModRevision, s.revision}, 200)
	}
	if c.Kind != "txn" || c.Txn == nil {
		panic("unknown committed command")
	}
	t := c.Txn
	canonical, _ := json.Marshal(t)
	if old, ok := s.dedup[t.RequestID]; ok {
		if old.Canonical != string(canonical) {
			return jsonReply(map[string]string{"error": "requestId already used with different content"}, 409)
		}
		return reply{old.Body, old.Code}
	}
	r := TxnResponse{RequestID: t.RequestID, Succeeded: true, Revision: s.revision, Results: []Result{}}
	for _, cmp := range t.Compare {
		if s.states[cmp.Key].ModRevision != cmp.ModRevision {
			r.Succeeded = false
			break
		}
	}
	code := 200
	if r.Succeeded && s.revision == maxInteger {
		result := jsonReply(map[string]string{"error": "revision exhausted"}, 507)
		s.dedup[t.RequestID] = savedResult{string(canonical), result.Body, result.Code}
		return result
	}
	if r.Succeeded {
		s.revision++
		r.Revision = s.revision
		for _, op := range t.Success {
			v := op.Value
			if op.Op == "delete" {
				v = nil
			}
			state := KeyState{v, s.revision}
			s.states[op.Key] = state
			if v == nil {
				delete(s.kvStore, op.Key)
			} else {
				s.kvStore[op.Key] = *v
			}
			r.Results = append(r.Results, Result{op.Key, v, s.revision})
		}
	}
	result := jsonReply(r, code)
	s.dedup[t.RequestID] = savedResult{string(canonical), result.Body, code}
	return result
}
func (s *kvstore) initialize() {
	if s.kvStore == nil {
		s.kvStore = map[string]string{}
	}
	if s.states == nil {
		s.states = map[string]KeyState{}
		for k, v := range s.kvStore {
			v := v
			s.states[k] = KeyState{Value: &v}
		}
	}
	if s.dedup == nil {
		s.dedup = map[string]savedResult{}
	}
	if s.waiters == nil {
		s.waiters = map[string]chan reply{}
	}
}

type stateSnapshot struct {
	Version  int                    `json:"version"`
	Applied  uint64                 `json:"appliedIndex"`
	Revision uint64                 `json:"revision"`
	States   map[string]KeyState    `json:"states"`
	Dedup    map[string]savedResult `json:"dedup"`
}

func validateSnapshot(p stateSnapshot) error {
	if p.Version != 1 || p.States == nil || p.Dedup == nil || p.Revision > maxInteger || p.Applied > maxInteger {
		return fmt.Errorf("invalid snapshot version/bounds: %d", p.Version)
	}
	return nil
}
