package conversations

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"crm-go-api/internal/models"
)

// ErrValidation indicates invalid input from the caller.
var ErrValidation = errors.New("validation failed")

var validChannels = map[string]bool{"email": true, "sms": true, "note": true}
var validStatuses = map[string]bool{"open": true, "resolved": true, "snoozed": true}
var validDirections = map[string]bool{"inbound": true, "outbound": true}

// Service holds conversation/message business logic and validation.
type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) ListConversations(ctx context.Context, accountID uuid.UUID, status string) ([]models.Conversation, error) {
	if status != "" && !validStatuses[status] {
		return nil, fmt.Errorf("conversations.ListConversations: %w: invalid status filter", ErrValidation)
	}
	return s.repo.ListConversations(ctx, accountID, status)
}

func (s *Service) GetConversation(ctx context.Context, accountID, id uuid.UUID) (*models.Conversation, error) {
	return s.repo.GetConversation(ctx, accountID, id)
}

func (s *Service) CreateConversation(ctx context.Context, accountID uuid.UUID, c *models.Conversation) (*models.Conversation, error) {
	if c.ContactID == uuid.Nil {
		return nil, fmt.Errorf("conversations.CreateConversation: %w: contact_id is required", ErrValidation)
	}
	if !validChannels[c.Channel] {
		return nil, fmt.Errorf("conversations.CreateConversation: %w: channel must be email, sms or note", ErrValidation)
	}
	if c.Status != "" && !validStatuses[c.Status] {
		return nil, fmt.Errorf("conversations.CreateConversation: %w: invalid status", ErrValidation)
	}
	return s.repo.CreateConversation(ctx, accountID, c)
}

func (s *Service) UpdateStatus(ctx context.Context, accountID, id uuid.UUID, status string) (*models.Conversation, error) {
	if !validStatuses[status] {
		return nil, fmt.Errorf("conversations.UpdateStatus: %w: invalid status", ErrValidation)
	}
	return s.repo.UpdateStatus(ctx, accountID, id, status)
}

func (s *Service) ListMessages(ctx context.Context, accountID, conversationID uuid.UUID) ([]models.Message, error) {
	return s.repo.ListMessages(ctx, accountID, conversationID)
}

func (s *Service) CreateMessage(ctx context.Context, accountID, conversationID uuid.UUID, m *models.Message) (*models.Message, error) {
	m.ConversationID = conversationID
	m.Content = strings.TrimSpace(m.Content)
	if m.Content == "" {
		return nil, fmt.Errorf("conversations.CreateMessage: %w: content is required", ErrValidation)
	}
	if !validChannels[m.Channel] {
		return nil, fmt.Errorf("conversations.CreateMessage: %w: channel must be email, sms or note", ErrValidation)
	}
	if !validDirections[m.Direction] {
		return nil, fmt.Errorf("conversations.CreateMessage: %w: direction must be inbound or outbound", ErrValidation)
	}
	return s.repo.CreateMessage(ctx, accountID, m)
}
