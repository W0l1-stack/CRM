package automations

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

var validTriggers = map[string]bool{
	models.TriggerContactCreated:    true,
	models.TriggerDealMoved:         true,
	models.TriggerFormSubmitted:     true,
	models.TriggerAppointmentBooked: true,
}

var validActions = map[string]bool{
	"send_email": true,
	"send_sms":   true,
	"add_tag":    true,
	"wait":       true,
}

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) List(ctx context.Context, accountID uuid.UUID) ([]models.Automation, error) {
	return s.repo.List(ctx, accountID)
}

func (s *Service) Get(ctx context.Context, accountID, id uuid.UUID) (*models.Automation, error) {
	return s.repo.GetByID(ctx, accountID, id)
}

func (s *Service) Create(ctx context.Context, accountID uuid.UUID, a *models.Automation) (*models.Automation, error) {
	if err := validate(a); err != nil {
		return nil, err
	}
	return s.repo.Create(ctx, accountID, a)
}

func (s *Service) Update(ctx context.Context, accountID, id uuid.UUID, a *models.Automation) (*models.Automation, error) {
	if err := validate(a); err != nil {
		return nil, err
	}
	return s.repo.Update(ctx, accountID, id, a)
}

func (s *Service) Delete(ctx context.Context, accountID, id uuid.UUID) error {
	return s.repo.Delete(ctx, accountID, id)
}

func validate(a *models.Automation) error {
	a.Name = strings.TrimSpace(a.Name)
	if a.Name == "" {
		return fmt.Errorf("automations.validate: %w: name is required", ErrValidation)
	}
	if !validTriggers[a.TriggerType] {
		return fmt.Errorf("automations.validate: %w: invalid trigger_type", ErrValidation)
	}
	for i, act := range a.Actions {
		if !validActions[act.Type] {
			return fmt.Errorf("automations.validate: %w: action %d has invalid type %q", ErrValidation, i, act.Type)
		}
	}
	return nil
}
