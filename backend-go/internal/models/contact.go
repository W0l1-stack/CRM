package models

import (
	"time"

	"github.com/google/uuid"
)

// Contact is a person an account is selling to.
type Contact struct {
	ID             uuid.UUID              `json:"id"`
	AccountID      uuid.UUID              `json:"account_id"`
	Name           string                 `json:"name"`
	Email          *string                `json:"email"`
	Phone          *string                `json:"phone"`
	Company        *string                `json:"company"`
	Source         *string                `json:"source"`
	Notes          *string                `json:"notes"`
	CustomFields   map[string]interface{} `json:"custom_fields"`
	Tags           []string               `json:"tags"`
	AssignedTo     *uuid.UUID             `json:"assigned_to"`
	IsUnsubscribed bool                   `json:"is_unsubscribed"`
	CreatedAt      time.Time              `json:"created_at"`
	UpdatedAt      time.Time              `json:"updated_at"`
}
