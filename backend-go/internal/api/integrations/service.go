package integrations

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"crm-go-api/internal/models"
)

var ErrValidation = errors.New("validation failed")

// ProviderSpec describes a provider's required secret fields so the UI can
// render the right inputs and the service can validate a Connect request.
type ProviderSpec struct {
	Provider string   `json:"provider"`
	Label    string   `json:"label"`
	Kind     string   `json:"kind"`
	Fields   []string `json:"fields"`    // secret credential keys
	FromHint string   `json:"from_hint"` // label for the "from" value
}

// CATALOG of supported providers (kept in sync with the Node adapters).
var CATALOG = []ProviderSpec{
	{Provider: "twilio", Label: "Twilio", Kind: "sms", Fields: []string{"account_sid", "auth_token"}, FromHint: "From number (e.g. +15551234567)"},
	{Provider: "vonage", Label: "Vonage", Kind: "sms", Fields: []string{"api_key", "api_secret"}, FromHint: "From / sender id"},
	{Provider: "messagebird", Label: "MessageBird", Kind: "sms", Fields: []string{"access_key"}, FromHint: "Originator"},
	{Provider: "resend", Label: "Resend", Kind: "email", Fields: []string{"api_key"}, FromHint: "From email"},
	{Provider: "sendgrid", Label: "SendGrid", Kind: "email", Fields: []string{"api_key"}, FromHint: "From email"},
	{Provider: "mailgun", Label: "Mailgun", Kind: "email", Fields: []string{"api_key", "domain"}, FromHint: "From email"},
	{Provider: "anthropic", Label: "Anthropic (Claude)", Kind: "ai", Fields: []string{"api_key"}, FromHint: "Model (optional, e.g. claude-sonnet-4-6)"},
}

func specFor(provider string) *ProviderSpec {
	for i := range CATALOG {
		if CATALOG[i].Provider == provider {
			return &CATALOG[i]
		}
	}
	return nil
}

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Catalog() []ProviderSpec { return CATALOG }

func (s *Service) List(ctx context.Context, accountID uuid.UUID) ([]models.AccountIntegration, error) {
	return s.repo.List(ctx, accountID)
}

// Connect validates and stores an account's provider credentials.
func (s *Service) Connect(ctx context.Context, accountID uuid.UUID, kind, provider, from string, config map[string]string) error {
	spec := specFor(provider)
	if spec == nil {
		return fmt.Errorf("integrations.Connect: %w: unknown provider", ErrValidation)
	}
	if spec.Kind != kind {
		return fmt.Errorf("integrations.Connect: %w: provider %q is not a %s provider", ErrValidation, provider, kind)
	}
	// A "from" (number/email) is required for sms/email; AI providers don't need one.
	if kind != "ai" && strings.TrimSpace(from) == "" {
		return fmt.Errorf("integrations.Connect: %w: a from value is required", ErrValidation)
	}
	clean := map[string]string{}
	for _, f := range spec.Fields {
		v := strings.TrimSpace(config[f])
		if v == "" {
			return fmt.Errorf("integrations.Connect: %w: %s is required", ErrValidation, f)
		}
		clean[f] = v
	}
	return s.repo.Upsert(ctx, accountID, kind, provider, strings.TrimSpace(from), clean)
}

func (s *Service) Disconnect(ctx context.Context, accountID uuid.UUID, kind string) error {
	if kind != "sms" && kind != "email" && kind != "ai" {
		return fmt.Errorf("integrations.Disconnect: %w: invalid kind", ErrValidation)
	}
	return s.repo.Delete(ctx, accountID, kind)
}
