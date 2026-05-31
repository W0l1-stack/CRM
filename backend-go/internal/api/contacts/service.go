package contacts

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

// Service holds contact business logic and validation.
type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
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
	return s.repo.Create(ctx, accountID, c)
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
