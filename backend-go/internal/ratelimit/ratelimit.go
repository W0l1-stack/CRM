// Package ratelimit provides a Redis-backed fixed-window rate limiter as HTTP
// middleware. It fails open: if Redis is unavailable the request is allowed.
package ratelimit

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"

	"crm-go-api/internal/api/response"
)

// Limiter holds the Redis connection. A nil *Limiter disables limiting.
type Limiter struct {
	rdb *redis.Client
}

// New builds a Limiter from a redis URL. Returns nil (no-op) when the URL is
// empty or unparseable, so rate limiting silently disables without Redis.
func New(redisURL string) *Limiter {
	if redisURL == "" {
		return nil
	}
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil
	}
	return &Limiter{rdb: redis.NewClient(opt)}
}

// Middleware limits to `limit` requests per `window` per key (from keyFn).
func (l *Limiter) Middleware(limit int, window time.Duration, keyFn func(*http.Request) string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if l == nil || l.rdb == nil {
				next.ServeHTTP(w, r)
				return
			}
			key := keyFn(r)
			if key == "" {
				next.ServeHTTP(w, r)
				return
			}

			ctx, cancel := context.WithTimeout(r.Context(), 200*time.Millisecond)
			defer cancel()

			bucket := time.Now().Unix() / int64(window.Seconds())
			rk := fmt.Sprintf("rl:%s:%d", key, bucket)

			count, err := l.rdb.Incr(ctx, rk).Result()
			if err != nil {
				next.ServeHTTP(w, r) // fail open
				return
			}
			if count == 1 {
				l.rdb.Expire(ctx, rk, window)
			}
			if count > int64(limit) {
				w.Header().Set("Retry-After", strconv.Itoa(int(window.Seconds())))
				response.Error(w, http.StatusTooManyRequests, "rate_limited", "too many requests — slow down")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
