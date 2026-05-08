package node

import (
	"sync"
	"sync/atomic"
	"time"
)

type entry struct {
	value     string
	expiresAt time.Time
}

func (e *entry) expired() bool {
	return !e.expiresAt.IsZero() && time.Now().After(e.expiresAt)
}

type Store struct {
	mu     sync.RWMutex
	data   map[string]*entry
	hits   atomic.Int64
	misses atomic.Int64
}

func NewStore() *Store {
	s := &Store{data: make(map[string]*entry)}
	go s.evictLoop()
	return s
}

func (s *Store) Set(key, value string, ttl time.Duration) {
	s.mu.Lock()
	defer s.mu.Unlock()
	e := &entry{value: value}
	if ttl > 0 {
		e.expiresAt = time.Now().Add(ttl)
	}
	s.data[key] = e
}

func (s *Store) Get(key string) (string, bool) {
	s.mu.RLock()
	e, ok := s.data[key]
	s.mu.RUnlock()
	if !ok || e.expired() {
		s.misses.Add(1)
		return "", false
	}
	s.hits.Add(1)
	return e.value, true
}

func (s *Store) Del(key string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, ok := s.data[key]
	delete(s.data, key)
	return ok
}

func (s *Store) TTL(key string) int64 {
	s.mu.RLock()
	e, ok := s.data[key]
	s.mu.RUnlock()
	if !ok || e.expired() {
		return -2
	}
	if e.expiresAt.IsZero() {
		return -1
	}
	return int64(time.Until(e.expiresAt).Seconds())
}

func (s *Store) Keys() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.data)
}

func (s *Store) Hits() int64   { return s.hits.Load() }
func (s *Store) Misses() int64 { return s.misses.Load() }

// All returns a snapshot of all live key→value pairs.
func (s *Store) All() map[string]string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	now := time.Now()
	out := make(map[string]string, len(s.data))
	for k, e := range s.data {
		if e.expiresAt.IsZero() || e.expiresAt.After(now) {
			out[k] = e.value
		}
	}
	return out
}

// AllWithTTL returns a snapshot of live key → remaining TTL seconds. -1 = no TTL.
func (s *Store) AllWithTTL() map[string]int64 {
	s.mu.RLock()
	defer s.mu.RUnlock()
	now := time.Now()
	out := make(map[string]int64, len(s.data))
	for k, e := range s.data {
		if e.expiresAt.IsZero() {
			out[k] = -1
		} else if e.expiresAt.After(now) {
			out[k] = int64(e.expiresAt.Sub(now).Seconds())
		}
	}
	return out
}

func (s *Store) evictLoop() {
	ticker := time.NewTicker(30 * time.Second)
	for range ticker.C {
		s.mu.Lock()
		for k, e := range s.data {
			if e.expired() {
				delete(s.data, k)
			}
		}
		s.mu.Unlock()
	}
}
