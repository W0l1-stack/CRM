package deals

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"crm-go-api/internal/events"
	"crm-go-api/internal/models"
)

// ErrValidation indicates invalid input from the caller.
var ErrValidation = errors.New("validation failed")

// Service holds deal business logic and validation.
type Service struct {
	repo      *Repository
	publisher *events.Publisher // nil-safe
}

func NewService(repo *Repository, publisher *events.Publisher) *Service {
	return &Service{repo: repo, publisher: publisher}
}

func (s *Service) List(ctx context.Context, accountID uuid.UUID, pipelineID *uuid.UUID) ([]models.Deal, error) {
	return s.repo.List(ctx, accountID, pipelineID)
}

func (s *Service) Get(ctx context.Context, accountID, id uuid.UUID) (*models.Deal, error) {
	return s.repo.GetByID(ctx, accountID, id)
}

func (s *Service) Create(ctx context.Context, accountID uuid.UUID, d *models.Deal) (*models.Deal, error) {
	if err := validate(d); err != nil {
		return nil, err
	}
	return s.repo.Create(ctx, accountID, d)
}

func (s *Service) Update(ctx context.Context, accountID, id uuid.UUID, d *models.Deal) (*models.Deal, error) {
	if err := validate(d); err != nil {
		return nil, err
	}

	// Capture the prior stage so we can detect a move.
	prev, err := s.repo.GetByID(ctx, accountID, id)
	if err != nil {
		return nil, err
	}

	updated, err := s.repo.Update(ctx, accountID, id, d)
	if err != nil {
		return nil, err
	}

	if prev.StageID != updated.StageID {
		_ = s.publisher.PublishTrigger(ctx, accountID, models.TriggerDealMoved, map[string]interface{}{
			"deal":           updated,
			"from_stage_id":  prev.StageID,
			"to_stage_id":    updated.StageID,
		})
	}
	return updated, nil
}

func (s *Service) Delete(ctx context.Context, accountID, id uuid.UUID) error {
	return s.repo.Delete(ctx, accountID, id)
}

func validate(d *models.Deal) error {
	d.Name = strings.TrimSpace(d.Name)
	if d.Name == "" {
		return fmt.Errorf("deals.validate: %w: name is required", ErrValidation)
	}
	if d.PipelineID == uuid.Nil {
		return fmt.Errorf("deals.validate: %w: pipeline_id is required", ErrValidation)
	}
	if d.ContactID == uuid.Nil {
		return fmt.Errorf("deals.validate: %w: contact_id is required", ErrValidation)
	}
	if strings.TrimSpace(d.StageID) == "" {
		return fmt.Errorf("deals.validate: %w: stage_id is required", ErrValidation)
	}
	if d.Probability < 0 || d.Probability > 100 {
		return fmt.Errorf("deals.validate: %w: probability must be between 0 and 100", ErrValidation)
	}
	return nil
}
