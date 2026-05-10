package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"crm-go-api/internal/api"
	"crm-go-api/internal/database"
	"crm-go-api/internal/middleware"
)

func main() {
	// Load environment
	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	// Initialize database
	db, err := database.Connect()
	if err != nil {
		log.Fatalf("Database connection failed: %v", err)
	}
	defer db.Close()

	// Run migrations
	if err := database.Migrate(db); err != nil {
		log.Fatalf("Migration failed: %v", err)
	}

	// Setup router
	router := api.NewRouter(db)

	// Global middleware
	router.Use(middleware.CORS)
	router.Use(middleware.Logger)

	// Health check
	router.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok"}`)
	}).Methods("GET")

	// Start server
	log.Printf("Go API Server starting on port %s", port)
	if err := http.ListenAndServe(":"+port, router); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
