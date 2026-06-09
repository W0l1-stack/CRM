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
	IntegrationsEncKey string
	AccessTokenTTL   time.Duration
	RefreshTokenTTL  time.Duration
	ResendAPIKey     string
	TwilioAccountSID string
	TwilioAuthToken  string
	TwilioFromNumber string
	StripeSecretKey  string
	StripeWebhookKey string
	StripePriceStarter string
	StripePricePro     string
	FrontendURL        string
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURL  string
	SentryDSN          string
}

// Load reads configuration from the environment and validates required values.
func Load() (*Config, error) {
	cfg := &Config{
		Port:             getEnv("PORT", "3001"),
		DatabaseURL:      os.Getenv("DATABASE_URL"),
		RedisURL:         os.Getenv("REDIS_URL"),
		JWTSecret:        os.Getenv("JWT_SECRET"),
		// Dedicated, stable key for encrypting account integration credentials.
		// Falls back to JWT_SECRET so existing creds keep decrypting; set this in
		// production before any customer connects a provider so rotating
		// JWT_SECRET never locks saved credentials.
		IntegrationsEncKey: getEnv("INTEGRATIONS_ENC_KEY", os.Getenv("JWT_SECRET")),
		AccessTokenTTL:   15 * time.Minute,
		RefreshTokenTTL:  7 * 24 * time.Hour,
		ResendAPIKey:     os.Getenv("RESEND_API_KEY"),
		TwilioAccountSID: os.Getenv("TWILIO_ACCOUNT_SID"),
		TwilioAuthToken:  os.Getenv("TWILIO_AUTH_TOKEN"),
		TwilioFromNumber: os.Getenv("TWILIO_FROM_NUMBER"),
		StripeSecretKey:  os.Getenv("STRIPE_SECRET_KEY"),
		StripeWebhookKey: os.Getenv("STRIPE_WEBHOOK_SECRET"),
		StripePriceStarter: os.Getenv("STRIPE_PRICE_STARTER"),
		StripePricePro:     os.Getenv("STRIPE_PRICE_PRO"),
		FrontendURL:        getEnv("FRONTEND_URL", "http://localhost:3000"),
		GoogleClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		GoogleRedirectURL:  getEnv("GOOGLE_REDIRECT_URL", "http://localhost:3001/api/v1/integrations/google/callback"),
		SentryDSN:          os.Getenv("SENTRY_DSN"),
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
