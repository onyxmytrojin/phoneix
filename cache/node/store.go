package node

import (
	"sync"
	"time"
)

type entry struct {
	value     string
	expiresAt time.Time // zero = no expiry
}

func (e *entry) expired() bool {
	return !e.expiresAt.IsZero() && time.Now().After(e.expiresAt)
}

type Store struct {
	mu   sync.RWMutex
	data map[string]*entry
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
		return "", false
	}
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
		return -2 // MISS
	}
	if e.expiresAt.IsZero() {
		return -1 // no TTL
	}
	return int64(time.Until(e.expiresAt).Seconds())
}

func (s *Store) Keys() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.data)
}

// background eviction: scan every 30s, delete expired keys
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
