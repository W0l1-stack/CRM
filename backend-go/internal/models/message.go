package models

import (
	"time"

	"github.com/google/uuid"
)

// Message is a single message inside a conversation.
type Message struct {
	ID             uuid.UUID  `json:"id"`
	AccountID      uuid.UUID  `json:"account_id"`
	ConversationID uuid.UUID  `json:"conversation_id"`
	SentBy         *uuid.UUID `json:"sent_by"`
	Direction      string     `json:"direction"`
	Channel        string     `json:"channel"`
	Content        string     `json:"content"`
	Status         string     `json:"status"`
	ExternalID     *string    `json:"external_id"`
	CreatedAt      time.Time  `json:"created_at"`
}
