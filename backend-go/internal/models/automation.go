package models

import (
	"time"

	"github.com/google/uuid"
)

// Trigger types an automation can fire on.
const (
	TriggerContactCreated   = "contact_created"
	TriggerDealMoved        = "deal_moved"
	TriggerFormSubmitted    = "form_submitted"
	TriggerAppointmentBooked = "appointment_booked"
)

// AutomationAction is one ordered step in a workflow. Config holds the
// per-action settings (e.g. {"tag":"hot lead"} or {"days":2} for a wait).
type AutomationAction struct {
	Type   string                 `json:"type"` // send_email, send_sms, add_tag, wait
	Config map[string]interface{} `json:"config"`
}

// Automation is a "when X happens, do Y" workflow. It fires when an incoming
// event matches any of its TriggerTypes.
type Automation struct {
	ID            uuid.UUID              `json:"id"`
	AccountID     uuid.UUID              `json:"account_id"`
	Name          string                 `json:"name"`
	IsActive      bool                   `json:"is_active"`
	TriggerTypes  []string               `json:"trigger_types"`
	TriggerConfig map[string]interface{} `json:"trigger_config"`
	Actions       []AutomationAction     `json:"actions"`
	CreatedAt     time.Time              `json:"created_at"`
	UpdatedAt     time.Time              `json:"updated_at"`
}
