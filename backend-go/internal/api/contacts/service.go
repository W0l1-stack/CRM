package contacts

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"crm-go-api/internal/events"
	"crm-go-api/internal/models"
	"crm-go-api/internal/plan"
)

// ErrValidation indicates invalid input from the caller.
var ErrValidation = errors.New("validation failed")

// ErrLimitReached re-exports the plan quota error for handler mapping.
var ErrLimitReached = plan.ErrLimitReached

// Service holds contact business logic and validation.
type Service struct {
	repo      *Repository
	publisher *events.Publisher // nil-safe; emits automation triggers
	enforcer  *plan.Enforcer    // nil-safe; plan quotas
}

func NewService(repo *Repository, publisher *events.Publisher, enforcer *plan.Enforcer) *Service {
	return &Service{repo: repo, publisher: publisher, enforcer: enforcer}
}

func (s *Service) List(ctx context.Context, accountID uuid.UUID, search, tag string) ([]models.Contact, error) {
	return s.repo.List(ctx, accountID, search, tag)
}

func (s *Service) Get(ctx context.Context, accountID, id uuid.UUID) (*models.Contact, error) {
	return s.repo.GetByID(ctx, accountID, id)
}

func (s *Service) Create(ctx context.Context, accountID uuid.UUID, c *models.Contact) (*models.Contact, error) {
	c.Name = strings.TrimSpace(c.Name)
	if c.Name == "" {
		return nil, fmt.Errorf("contacts.Create: %w: name is required", ErrValidation)
	}
	if c.Source == nil || strings.TrimSpace(*c.Source) == "" {
		manual := "manual"
		c.Source = &manual
	}
	if err := s.enforcer.Check(ctx, accountID, "contacts"); err != nil {
		return nil, err
	}
	created, err := s.repo.Create(ctx, accountID, c)
	if err != nil {
		return nil, err
	}
	// Best-effort: fire the contact_created automation trigger. A publish
	// failure must not fail contact creation.
	_ = s.publisher.PublishTrigger(ctx, accountID, models.TriggerContactCreated, created)
	return created, nil
}

func (s *Service) Update(ctx context.Context, accountID, id uuid.UUID, c *models.Contact) (*models.Contact, error) {
	c.Name = strings.TrimSpace(c.Name)
	if c.Name == "" {
		return nil, fmt.Errorf("contacts.Update: %w: name is required", ErrValidation)
	}
	return s.repo.Update(ctx, accountID, id, c)
}

func (s *Service) Delete(ctx context.Context, accountID, id uuid.UUID) error {
	return s.repo.Delete(ctx, accountID, id)
}

// Timeline returns a contact's recent activity. It first confirms the contact
// belongs to the account (so unknown ids return ErrNotFound, not an empty list).
func (s *Service) Timeline(ctx context.Context, accountID, contactID uuid.UUID, limit int) ([]TimelineEvent, error) {
	if _, err := s.repo.GetByID(ctx, accountID, contactID); err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	return s.repo.Timeline(ctx, accountID, contactID, limit)
}
