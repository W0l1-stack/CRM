package pipelines

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

// Service holds pipeline business logic and validation.
type Service struct {
	repo     *Repository
	enforcer *plan.Enforcer
}

func NewService(repo *Repository, enforcer *plan.Enforcer) *Service {
	return &Service{repo: repo, enforcer: enforcer}
}

func (s *Service) List(ctx context.Context, accountID uuid.UUID) ([]models.Pipeline, error) {
	return s.repo.List(ctx, accountID)
}

func (s *Service) Get(ctx context.Context, accountID, id uuid.UUID) (*models.Pipeline, error) {
	return s.repo.GetByID(ctx, accountID, id)
}

func (s *Service) Create(ctx context.Context, accountID uuid.UUID, p *models.Pipeline) (*models.Pipeline, error) {
	if err := validate(p); err != nil {
		return nil, err
	}
	if err := s.enforcer.Check(ctx, accountID, "pipelines"); err != nil {
		return nil, err
	}
	return s.repo.Create(ctx, accountID, p)
}

func (s *Service) Update(ctx context.Context, accountID, id uuid.UUID, p *models.Pipeline) (*models.Pipeline, error) {
	if err := validate(p); err != nil {
		return nil, err
	}
	return s.repo.Update(ctx, accountID, id, p)
}

func (s *Service) Delete(ctx context.Context, accountID, id uuid.UUID) error {
	return s.repo.Delete(ctx, accountID, id)
}

// validate checks a pipeline's name and stages. Stage ids must be unique so
// deals (which reference stage_id) map unambiguously to a column.
func validate(p *models.Pipeline) error {
	p.Name = strings.TrimSpace(p.Name)
	if p.Name == "" {
		return fmt.Errorf("pipelines.validate: %w: name is required", ErrValidation)
	}
	if len(p.Stages) == 0 {
		return fmt.Errorf("pipelines.validate: %w: at least one stage is required", ErrValidation)
	}
	seen := make(map[string]bool, len(p.Stages))
	for i := range p.Stages {
		p.Stages[i].ID = strings.TrimSpace(p.Stages[i].ID)
		p.Stages[i].Name = strings.TrimSpace(p.Stages[i].Name)
		if p.Stages[i].ID == "" || p.Stages[i].Name == "" {
			return fmt.Errorf("pipelines.validate: %w: stage %d needs an id and name", ErrValidation, i)
		}
		if seen[p.Stages[i].ID] {
			return fmt.Errorf("pipelines.validate: %w: duplicate stage id %q", ErrValidation, p.Stages[i].ID)
		}
		seen[p.Stages[i].ID] = true
	}
	return nil
}
