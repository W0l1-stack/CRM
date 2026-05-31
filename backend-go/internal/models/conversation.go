package models

import (
	"time"

	"github.com/google/uuid"
)

// Conversation is a thread of messages with a single contact on one channel.
type Conversation struct {
	ID            uuid.UUID  `json:"id"`
	AccountID     uuid.UUID  `json:"account_id"`
	ContactID     uuid.UUID  `json:"contact_id"`
	AssignedTo    *uuid.UUID `json:"assigned_to"`
	Channel       string     `json:"channel"`
	Status        string     `json:"status"`
	Subject       *string    `json:"subject"`
	LastMessageAt *time.Time `json:"last_message_at"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}
