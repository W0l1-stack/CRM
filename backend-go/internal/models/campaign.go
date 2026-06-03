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

// CampaignRecipient is one contact a campaign was sent to, with per-contact
// open/click tracking populated from Resend webhook events.
type CampaignRecipient struct {
	ID          uuid.UUID  `json:"id"`
	CampaignID  uuid.UUID  `json:"campaign_id"`
	ContactID   uuid.UUID  `json:"contact_id"`
	ContactName string     `json:"contact_name"`
	Email       string     `json:"email"`
	Status      string     `json:"status"` // sent, delivered, opened, clicked, bounced, unsubscribed
	SentAt      *time.Time `json:"sent_at"`
	OpenedAt    *time.Time `json:"opened_at"`
	ClickedAt   *time.Time `json:"clicked_at"`
}
