package campaigns

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"crm-go-api/internal/events"
	"crm-go-api/internal/models"
)

var ErrValidation = errors.New("validation failed")
var ErrAlreadySent = errors.New("campaign already sent")

type Service struct {
	repo      *Repository
	publisher *events.Publisher // nil-safe
}

func NewService(repo *Repository, publisher *events.Publisher) *Service {
	return &Service{repo: repo, publisher: publisher}
}

func (s *Service) List(ctx context.Context, accountID uuid.UUID) ([]models.Campaign, error) {
	return s.repo.List(ctx, accountID)
}

func (s *Service) Get(ctx context.Context, accountID, id uuid.UUID) (*models.Campaign, error) {
	return s.repo.GetByID(ctx, accountID, id)
}

func (s *Service) Create(ctx context.Context, accountID uuid.UUID, createdBy *uuid.UUID, c *models.Campaign) (*models.Campaign, error) {
	if err := validate(c); err != nil {
		return nil, err
	}
	return s.repo.Create(ctx, accountID, createdBy, c)
}

func (s *Service) Update(ctx context.Context, accountID, id uuid.UUID, c *models.Campaign) (*models.Campaign, error) {
	if err := validate(c); err != nil {
		return nil, err
	}
	return s.repo.Update(ctx, accountID, id, c)
}

func (s *Service) Delete(ctx context.Context, accountID, id uuid.UUID) error {
	return s.repo.Delete(ctx, accountID, id)
}

// Send marks a draft/scheduled campaign as sending and hands recipient
// resolution + delivery to the Node service over Redis.
func (s *Service) Send(ctx context.Context, accountID, id uuid.UUID) (*models.Campaign, error) {
	c, err := s.repo.GetByID(ctx, accountID, id)
	if err != nil {
		return nil, err
	}
	if c.Status == "sending" || c.Status == "sent" {
		return nil, ErrAlreadySent
	}
	if err := s.repo.SetStatus(ctx, accountID, id, "sending"); err != nil {
		return nil, err
	}
	if err := s.publisher.PublishCampaignSend(ctx, accountID, id, 0); err != nil {
		// Roll back to draft so it can be retried.
		_ = s.repo.SetStatus(ctx, accountID, id, "draft")
		return nil, fmt.Errorf("campaigns.Send: %w", err)
	}
	c.Status = "sending"
	return c, nil
}

// Schedule queues a campaign to send at a future time via a delayed job.
func (s *Service) Schedule(ctx context.Context, accountID, id uuid.UUID, scheduledAt time.Time) (*models.Campaign, error) {
	c, err := s.repo.GetByID(ctx, accountID, id)
	if err != nil {
		return nil, err
	}
	if c.Status == "sending" || c.Status == "sent" {
		return nil, ErrAlreadySent
	}
	if !scheduledAt.After(time.Now()) {
		return nil, fmt.Errorf("campaigns.Schedule: %w: scheduled_at must be in the future", ErrValidation)
	}
	if err := s.repo.SetScheduled(ctx, accountID, id, scheduledAt); err != nil {
		return nil, err
	}
	delayMs := time.Until(scheduledAt).Milliseconds()
	if err := s.publisher.PublishCampaignSend(ctx, accountID, id, delayMs); err != nil {
		_ = s.repo.SetStatus(ctx, accountID, id, "draft")
		return nil, fmt.Errorf("campaigns.Schedule: %w", err)
	}
	c.Status = "scheduled"
	return c, nil
}

func (s *Service) Unsubscribe(ctx context.Context, accountID, contactID uuid.UUID) error {
	return s.repo.Unsubscribe(ctx, accountID, contactID)
}

// Recipients returns per-contact open/click tracking for a campaign. It first
// confirms the campaign belongs to the account.
func (s *Service) Recipients(ctx context.Context, accountID, campaignID uuid.UUID) ([]models.CampaignRecipient, error) {
	if _, err := s.repo.GetByID(ctx, accountID, campaignID); err != nil {
		return nil, err
	}
	return s.repo.ListRecipients(ctx, accountID, campaignID)
}

func validate(c *models.Campaign) error {
	c.Name = strings.TrimSpace(c.Name)
	c.Subject = strings.TrimSpace(c.Subject)
	if c.Channel == "" {
		c.Channel = "email"
	}
	if c.Channel != "email" && c.Channel != "sms" && c.Channel != "journey" {
		return fmt.Errorf("campaigns.validate: %w: channel must be email, sms or journey", ErrValidation)
	}
	if c.Name == "" {
		return fmt.Errorf("campaigns.validate: %w: name is required", ErrValidation)
	}
	// Journey campaigns enroll the audience into an automation; no subject/body.
	if c.Channel == "journey" {
		if c.AutomationID == nil {
			return fmt.Errorf("campaigns.validate: %w: an automation is required for a journey campaign", ErrValidation)
		}
		return nil
	}
	// Subject only applies to email; SMS has no subject line.
	if c.Channel == "email" && c.Subject == "" {
		return fmt.Errorf("campaigns.validate: %w: subject is required", ErrValidation)
	}
	if strings.TrimSpace(c.BodyHTML) == "" {
		return fmt.Errorf("campaigns.validate: %w: message body is required", ErrValidation)
	}
	return nil
}
