package models

import (
	"time"

	"github.com/google/uuid"
)

// AccountIntegration is a per-account provider connection (the account's own
// Twilio/Vonage/Resend/etc. credentials). Secrets live in Config (encrypted at
// rest) and are never serialized to the client — only provider/from/connected.
type AccountIntegration struct {
	ID        uuid.UUID         `json:"id"`
	AccountID uuid.UUID         `json:"account_id"`
	Kind      string            `json:"kind"`     // sms, email
	Provider  string            `json:"provider"` // twilio, vonage, messagebird, resend, sendgrid, mailgun
	From      string            `json:"from"`
	IsActive  bool              `json:"is_active"`
	Config    map[string]string `json:"-"`
	CreatedAt time.Time         `json:"created_at"`
	UpdatedAt time.Time         `json:"updated_at"`
}
