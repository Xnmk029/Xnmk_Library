package main

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestTransactionValidation(t *testing.T) {
	invalid := []string{
		`null`, `{}`, `{"requestId":"r","compare":[],"success":[]}`,
		`{"requestId":"r","compare":[{"key":"x"}],"success":[{"op":"put","key":"x","value":"a"}]}`,
		`{"requestId":"r","compare":[{"key":"x","modRevision":9007199254740992}],"success":[{"op":"delete","key":"x"}]}`,
		`{"requestId":"r","compare":[{"key":"x","modRevision":1.0}],"success":[{"op":"delete","key":"x"}]}`,
		`{"requestId":"r","compare":[],"success":[{"op":"put","key":"x","value":null}]}`,
		`{"requestId":"r","compare":[],"success":[{"op":"put","key":"x","value":1}]}`,
		`{"requestId":"r","compare":[],"success":[{"op":"delete","key":"x"},{"op":"delete","key":"x"}]}`,
		`{"requestId":"r","compare":[{"key":"x","modRevision":0},{"key":"x","modRevision":0}],"success":[{"op":"delete","key":"x"}]}`,
		`{"requestId":"r","requestId":"s","compare":[],"success":[{"op":"delete","key":"x"}]}`,
		`{"requestId":"r","compare":[],"success":[{"op":"increment","key":"x"}]}`,
		`{"requestId":"r","compare":[],"success":[{"op":"delete","key":"x"}]} {}`,
	}
	for _, input := range invalid {
		if _, err := parseTransaction([]byte(input)); err == nil {
			t.Errorf("accepted %s", input)
		}
	}
	good := `{"success":[{"value":"a","key":"x","op":"put"}],"compare":[],"requestId":"r"}`
	if _, err := parseTransaction([]byte(good)); err != nil {
		t.Fatal(err)
	}
}

func TestInvalidHTTPDoesNotPropose(t *testing.T) {
	proposals := make(chan string, 1)
	s := &kvstore{proposeC: proposals}
	s.initialize()
	h := &httpKVAPI{store: s}
	r := httptest.NewRequest("POST", "/v1/txn", strings.NewReader(`{"requestId":"bad","compare":[],"success":[{"op":"put","key":"x","value":null}]}`))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != 400 || len(proposals) != 0 || len(s.waiters) != 0 {
		t.Fatal("invalid request proposed or leaked waiter", w.Code)
	}
}
func TestStateMachineAtomicityDedupAndSnapshot(t *testing.T) {
	s := &kvstore{}
	s.initialize()
	apply := func(raw string) reply {
		t.Helper()
		txn, err := parseTransaction([]byte(raw))
		if err != nil {
			t.Fatal(err)
		}
		return s.applyCommand(command{Kind: "txn", Txn: txn})
	}
	first := `{"requestId":"first","compare":[],"success":[{"op":"put","key":"a","value":"A"},{"op":"put","key":"b","value":"B"}]}`
	original := apply(first)
	fail := `{"requestId":"fail","compare":[{"key":"a","modRevision":0}],"success":[{"op":"delete","key":"a"},{"op":"delete","key":"b"}]}`
	failed := apply(fail)
	if s.revision != 1 || *s.states["b"].Value != "B" {
		t.Fatal("partial failed transaction")
	}
	apply(`{"requestId":"delete","compare":[],"success":[{"op":"delete","key":"a"},{"op":"delete","key":"absent"}]}`)
	if s.states["a"].ModRevision != 2 || s.states["absent"].ModRevision != 2 {
		t.Fatal("lost tombstones")
	}
	apply(`{"requestId":"aba","compare":[{"key":"a","modRevision":0}],"success":[{"op":"put","key":"a","value":"bad"}]}`)
	if s.revision != 2 {
		t.Fatal("ABA allowed")
	}
	if string(failed.Body) != string(apply(fail).Body) {
		t.Fatal("failed result not stable")
	}
	if apply(`{"requestId":"first","compare":[],"success":[{"op":"delete","key":"b"}]}`).Code != 409 {
		t.Fatal("missing conflict")
	}
	s.applied = 27
	b, err := s.getSnapshot()
	if err != nil {
		t.Fatal(err)
	}
	restored := &kvstore{}
	if err := restored.recoverFromSnapshot(b); err != nil {
		t.Fatal(err)
	}
	s = restored
	if s.applied != 27 || s.states["a"].ModRevision != 2 {
		t.Fatal("snapshot boundary/tombstone lost")
	}
	if string(original.Body) != string(apply(first).Body) || string(failed.Body) != string(apply(fail).Body) {
		t.Fatal("snapshot lost dedup")
	}
	if err := s.recoverFromSnapshot([]byte(`{"version":2}`)); err == nil {
		t.Fatal("unknown snapshot accepted")
	}
}
func TestTimeoutCancelsWaiterButLateCommitApplies(t *testing.T) {
	proposals := make(chan string, 1)
	s := &kvstore{proposeC: proposals}
	s.initialize()
	txn, _ := parseTransaction([]byte(`{"requestId":"late","compare":[],"success":[{"op":"delete","key":"x"}]}`))
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()
	if _, err := s.submit(ctx, command{Kind: "txn", Txn: txn}); err == nil {
		t.Fatal("expected timeout")
	}
	if len(s.waiters) != 0 {
		t.Fatal("waiter leaked")
	}
	var c command
	if err := json.Unmarshal([]byte(<-proposals), &c); err != nil {
		t.Fatal(err)
	}
	s.applyCommand(c)
	if s.revision != 1 {
		t.Fatal("late commit lost")
	}
}
