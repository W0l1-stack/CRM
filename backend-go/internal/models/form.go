package models

import (
	"time"

	"github.com/google/uuid"
)

// FormField defines one input on a lead-capture form.
type FormField struct {
	Name        string   `json:"name"`  // maps to a contact field or custom field
	Label       string   `json:"label"`
	Type        string   `json:"type"`  // semantic (name/email/phone/company/address/...) or basic (single_line/paragraph/number/date/dropdown/radio/multiselect/checkbox)
	Placeholder string   `json:"placeholder,omitempty"`
	Required    bool     `json:"required"`
	Options     []string `json:"options,omitempty"` // choices for dropdown/radio/multiselect
	Width       string   `json:"width,omitempty"`   // "full" (default) or "half" for two-column rows
}

// Form is an embeddable lead-capture form.
type Form struct {
	ID              uuid.UUID              `json:"id"`
	AccountID       uuid.UUID              `json:"account_id"`
	Name            string                 `json:"name"`
	Fields          []FormField            `json:"fields"`
	Settings        map[string]interface{} `json:"settings"` // redirect_url, thank_you_message
	SubmissionCount int                    `json:"submission_count"`
	CreatedAt       time.Time              `json:"created_at"`
}
