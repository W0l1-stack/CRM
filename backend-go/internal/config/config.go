package config

import (
	"fmt"
	"os"
	"time"
)

// Config holds all runtime configuration, read from environment variables.
type Config struct {
	Port             string
	DatabaseURL      string
	RedisURL         string
	JWTSecret        string
	AccessTokenTTL   time.Duration
	RefreshTokenTTL  time.Duration
	ResendAPIKey     string
	TwilioAccountSID string
	TwilioAuthToken  string
	TwilioFromNumber string
	StripeSecretKey  string
	StripeWebhookKey string
}

// Load reads configuration from the environment and validates required values.
func Load() (*Config, error) {
	cfg := &Config{
		Port:             getEnv("PORT", "3001"),
		DatabaseURL:      os.Getenv("DATABASE_URL"),
		RedisURL:         os.Getenv("REDIS_URL"),
		JWTSecret:        os.Getenv("JWT_SECRET"),
		AccessTokenTTL:   15 * time.Minute,
		RefreshTokenTTL:  7 * 24 * time.Hour,
		ResendAPIKey:     os.Getenv("RESEND_API_KEY"),
		TwilioAccountSID: os.Getenv("TWILIO_ACCOUNT_SID"),
		TwilioAuthToken:  os.Getenv("TWILIO_AUTH_TOKEN"),
		TwilioFromNumber: os.Getenv("TWILIO_FROM_NUMBER"),
		StripeSecretKey:  os.Getenv("STRIPE_SECRET_KEY"),
		StripeWebhookKey: os.Getenv("STRIPE_WEBHOOK_SECRET"),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("config.Load: DATABASE_URL is required")
	}
	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("config.Load: JWT_SECRET is required")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
