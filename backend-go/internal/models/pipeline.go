package models

import (
	"time"

	"github.com/google/uuid"
)

// Stage is one column of a pipeline's Kanban board.
type Stage struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Order int    `json:"order"`
}

// Pipeline is a sales process made of ordered stages.
type Pipeline struct {
	ID        uuid.UUID `json:"id"`
	AccountID uuid.UUID `json:"account_id"`
	Name      string    `json:"name"`
	Stages    []Stage   `json:"stages"`
	CreatedAt time.Time `json:"created_at"`
}
