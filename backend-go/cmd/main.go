package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"time"

	"crm-go-api/internal/api"
	"crm-go-api/internal/config"
	"crm-go-api/internal/database"
	"crm-go-api/internal/events"
	"crm-go-api/internal/middleware"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	cfg, err := config.Load()
	if err != nil {
		slog.Error("config load failed", "err", err)
		os.Exit(1)
	}

	ctx := context.Background()

	pool, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("database connection failed", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := database.Migrate(ctx, pool); err != nil {
		slog.Error("migration failed", "err", err)
		os.Exit(1)
	}

	// Event publisher (Redis). Optional: if it can't connect we log and run
	// without realtime/automation triggers rather than failing to boot.
	var publisher *events.Publisher
	if cfg.RedisURL != "" {
		publisher, err = events.NewPublisher(cfg.RedisURL)
		if err != nil {
			slog.Warn("redis publisher disabled", "err", err)
			publisher = nil
		} else {
			defer publisher.Close()
		}
	}

	router := api.NewRouter(pool, cfg, publisher)

	srv := &http.Server{
		Addr: ":" + cfg.Port,
		// CORS wraps the whole router so it also answers preflight (OPTIONS)
		// requests that don't match a registered method/route.
		Handler:      middleware.CORS(router),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	slog.Info("Go API server listening", "port", cfg.Port)
	if err := srv.ListenAndServe(); err != nil {
		slog.Error("server failed", "err", err)
		os.Exit(1)
	}
}
