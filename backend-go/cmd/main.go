package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"crm-go-api/internal/api"
	"crm-go-api/internal/config"
	"crm-go-api/internal/database"
	"crm-go-api/internal/events"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx := context.Background()

	pool, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer pool.Close()

	if err := database.Migrate(ctx, pool); err != nil {
		log.Fatalf("migration failed: %v", err)
	}

	// Event publisher (Redis). Optional: if it can't connect we log and run
	// without realtime/automation triggers rather than failing to boot.
	var publisher *events.Publisher
	if cfg.RedisURL != "" {
		publisher, err = events.NewPublisher(cfg.RedisURL)
		if err != nil {
			log.Printf("warning: redis publisher disabled: %v", err)
			publisher = nil
		} else {
			defer publisher.Close()
		}
	}

	router := api.NewRouter(pool, cfg, publisher)

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Printf("Go API server listening on port %s", cfg.Port)
	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
