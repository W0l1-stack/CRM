package models

import (
	"time"

	"github.com/google/uuid"
)

// Deal is a specific opportunity living in a pipeline stage.
type Deal struct {
	ID          uuid.UUID  `json:"id"`
	AccountID   uuid.UUID  `json:"account_id"`
	PipelineID  uuid.UUID  `json:"pipeline_id"`
	ContactID   uuid.UUID  `json:"contact_id"`
	AssignedTo  *uuid.UUID `json:"assigned_to"`
	Name        string     `json:"name"`
	Value       float64    `json:"value"`
	StageID     string     `json:"stage_id"`
	Probability int        `json:"probability"`
	CloseDate   *time.Time `json:"close_date"`
	Notes       *string    `json:"notes"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}
