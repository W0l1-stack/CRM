package automations

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"crm-go-api/internal/models"
	"crm-go-api/internal/plan"
)

// ErrValidation indicates invalid input from the caller.
var ErrValidation = errors.New("validation failed")

// ErrLimitReached re-exports the plan quota error for handler mapping.
var ErrLimitReached = plan.ErrLimitReached

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
	"branch":     true, // multi-way condition; nested actions live in config.cases/default
}

type Service struct {
	repo     *Repository
	enforcer *plan.Enforcer
}

func NewService(repo *Repository, enforcer *plan.Enforcer) *Service {
	return &Service{repo: repo, enforcer: enforcer}
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
	if err := s.enforcer.Check(ctx, accountID, "automations"); err != nil {
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
	if len(a.TriggerTypes) == 0 {
		return fmt.Errorf("automations.validate: %w: at least one trigger is required", ErrValidation)
	}
	seen := make(map[string]bool, len(a.TriggerTypes))
	deduped := a.TriggerTypes[:0]
	for _, t := range a.TriggerTypes {
		if !validTriggers[t] {
			return fmt.Errorf("automations.validate: %w: invalid trigger %q", ErrValidation, t)
		}
		if seen[t] {
			continue
		}
		seen[t] = true
		deduped = append(deduped, t)
	}
	a.TriggerTypes = deduped
	for i, act := range a.Actions {
		if !validActions[act.Type] {
			return fmt.Errorf("automations.validate: %w: action %d has invalid type %q", ErrValidation, i, act.Type)
		}
	}
	return nil
}
