package ratelimit

import (
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// PerIP is a tiny in-memory token-bucket limiter keyed by client IP.
//
// It's intentionally simple: a single map under a mutex, with stale
// entries lazily evicted on access. This is enough because the API
// pod runs as a single replica (see chart values) and the request
// rate is low - generation jobs take much longer than rate-limit
// bookkeeping.
type PerIP struct {
	mu       sync.Mutex
	limiters map[string]*entry
	rate     rate.Limit
	burst    int
}

type entry struct {
	lim  *rate.Limiter
	seen time.Time
}

func NewPerIP(perSecond float64, burst int) *PerIP {
	return &PerIP{
		limiters: make(map[string]*entry),
		rate:     rate.Limit(perSecond),
		burst:    burst,
	}
}

func (p *PerIP) Allow(ip string) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	now := time.Now()
	// Lazy GC of entries unused for more than 10 minutes - keeps the
	// map bounded without a background goroutine.
	for k, e := range p.limiters {
		if now.Sub(e.seen) > 10*time.Minute {
			delete(p.limiters, k)
		}
	}
	e, ok := p.limiters[ip]
	if !ok {
		e = &entry{lim: rate.NewLimiter(p.rate, p.burst)}
		p.limiters[ip] = e
	}
	e.seen = now
	return e.lim.Allow()
}
