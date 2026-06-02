package models

import (
	"time"

	"github.com/google/uuid"
)

// Campaign is a bulk email send to a filtered set of contacts.
type Campaign struct {
	ID              uuid.UUID              `json:"id"`
	AccountID       uuid.UUID              `json:"account_id"`
	CreatedBy       *uuid.UUID             `json:"created_by"`
	Name            string                 `json:"name"`
	Subject         string                 `json:"subject"`
	BodyHTML        string                 `json:"body_html"`
	Status          string                 `json:"status"` // draft, scheduled, sending, sent
	ScheduledAt     *time.Time             `json:"scheduled_at"`
	SentAt          *time.Time             `json:"sent_at"`
	RecipientFilter map[string]interface{} `json:"recipient_filter"` // e.g. {"tag":"hot lead"}
	Stats           map[string]interface{} `json:"stats"`
	CreatedAt       time.Time              `json:"created_at"`
	UpdatedAt       time.Time              `json:"updated_at"`
}
