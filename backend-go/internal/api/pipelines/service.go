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
	p.Name = strings.TrimSpace(p.Name)
	if p.Name == "" {
		return nil, fmt.Errorf("pipelines.Create: %w: name is required", ErrValidation)
	}
	if len(p.Stages) == 0 {
		return nil, fmt.Errorf("pipelines.Create: %w: at least one stage is required", ErrValidation)
	}
	for i, st := range p.Stages {
		if strings.TrimSpace(st.ID) == "" || strings.TrimSpace(st.Name) == "" {
			return nil, fmt.Errorf("pipelines.Create: %w: stage %d needs an id and name", ErrValidation, i)
		}
	}
	if err := s.enforcer.Check(ctx, accountID, "pipelines"); err != nil {
		return nil, err
	}
	return s.repo.Create(ctx, accountID, p)
}
