package database

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Connect opens a pooled PostgreSQL connection using the given DATABASE_URL
// and verifies it with a ping, retrying a few times so a transient DNS or
// network hiccup at boot doesn't kill the process. PostgreSQL only (pgx/v5).
func Connect(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("database.Connect: parse config: %w", err)
	}

	cfg.MaxConns = 10
	cfg.MaxConnLifetime = time.Hour
	cfg.MaxConnIdleTime = 30 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("database.Connect: new pool: %w", err)
	}

	const attempts = 6
	for i := 1; i <= attempts; i++ {
		pingCtx, cancel := context.WithTimeout(ctx, 8*time.Second)
		err = pool.Ping(pingCtx)
		cancel()
		if err == nil {
			return pool, nil
		}
		slog.Warn("database ping failed, retrying", "attempt", i, "of", attempts, "err", err.Error())
		select {
		case <-ctx.Done():
			pool.Close()
			return nil, fmt.Errorf("database.Connect: %w", ctx.Err())
		case <-time.After(time.Duration(i) * 2 * time.Second):
		}
	}

	pool.Close()
	return nil, fmt.Errorf("database.Connect: ping after %d attempts: %w", attempts, err)
}
