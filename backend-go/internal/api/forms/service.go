package forms

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"crm-go-api/internal/events"
	"crm-go-api/internal/models"
)

var ErrValidation = errors.New("validation failed")

type Service struct {
	repo      *Repository
	publisher *events.Publisher // nil-safe
}

func NewService(repo *Repository, publisher *events.Publisher) *Service {
	return &Service{repo: repo, publisher: publisher}
}

func (s *Service) List(ctx context.Context, accountID uuid.UUID) ([]models.Form, error) {
	return s.repo.List(ctx, accountID)
}

func (s *Service) Get(ctx context.Context, accountID, id uuid.UUID) (*models.Form, error) {
	return s.repo.GetByID(ctx, accountID, id)
}

func (s *Service) GetPublic(ctx context.Context, id uuid.UUID) (*models.Form, error) {
	return s.repo.GetPublic(ctx, id)
}

func (s *Service) Create(ctx context.Context, accountID uuid.UUID, f *models.Form) (*models.Form, error) {
	if err := validate(f); err != nil {
		return nil, err
	}
	return s.repo.Create(ctx, accountID, f)
}

func (s *Service) Update(ctx context.Context, accountID, id uuid.UUID, f *models.Form) (*models.Form, error) {
	if err := validate(f); err != nil {
		return nil, err
	}
	return s.repo.Update(ctx, accountID, id, f)
}

func (s *Service) Delete(ctx context.Context, accountID, id uuid.UUID) error {
	return s.repo.Delete(ctx, accountID, id)
}

// SubmitResult is returned to the public form page after a submission.
type SubmitResult struct {
	ContactID uuid.UUID              `json:"contact_id"`
	Settings  map[string]interface{} `json:"settings"`
}

// Submit creates/updates a contact from a public form submission, bumps the
// submission count, and fires the form_submitted automation trigger.
func (s *Service) Submit(ctx context.Context, formID uuid.UUID, values map[string]string) (*SubmitResult, error) {
	form, err := s.repo.GetPublic(ctx, formID)
	if err != nil {
		return nil, err
	}

	email := strings.ToLower(strings.TrimSpace(pick(values, "email")))
	name := strings.TrimSpace(firstNonEmpty(pick(values, "name"), pick(values, "full_name")))
	phone := strings.TrimSpace(firstNonEmpty(pick(values, "phone"), pick(values, "tel")))

	if email == "" && name == "" {
		return nil, fmt.Errorf("forms.Submit: %w: an email or name is required", ErrValidation)
	}

	contactID, err := s.repo.UpsertContact(ctx, form.AccountID, name, email, phone)
	if err != nil {
		return nil, err
	}
	if err := s.repo.IncrementSubmissions(ctx, form.ID); err != nil {
		return nil, err
	}

	_ = s.publisher.PublishTrigger(ctx, form.AccountID, models.TriggerFormSubmitted, map[string]interface{}{
		"form_id": form.ID,
		"contact": map[string]interface{}{"id": contactID, "name": name, "email": email, "phone": phone},
		"values":  values,
	})

	return &SubmitResult{ContactID: contactID, Settings: form.Settings}, nil
}

func validate(f *models.Form) error {
	f.Name = strings.TrimSpace(f.Name)
	if f.Name == "" {
		return fmt.Errorf("forms.validate: %w: name is required", ErrValidation)
	}
	if len(f.Fields) == 0 {
		return fmt.Errorf("forms.validate: %w: at least one field is required", ErrValidation)
	}
	for i, fld := range f.Fields {
		if strings.TrimSpace(fld.Name) == "" {
			return fmt.Errorf("forms.validate: %w: field %d needs a name", ErrValidation, i)
		}
	}
	return nil
}

func pick(m map[string]string, key string) string {
	for k, v := range m {
		if strings.EqualFold(strings.TrimSpace(k), key) {
			return v
		}
	}
	return ""
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
