package subaccounts

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"crm-go-api/internal/api/auth"
	"crm-go-api/internal/models"
)

var ErrValidation = errors.New("validation failed")
var ErrForbidden = errors.New("not your sub-account")

const trialDays = 14

// Service holds the agency / sub-account logic. It depends on the auth service
// to mint a session when switching into a sub-account.
type Service struct {
	repo    *Repository
	authSvc *auth.Service
}

func NewService(repo *Repository, authSvc *auth.Service) *Service {
	return &Service{repo: repo, authSvc: authSvc}
}

// CreateResult returns the new sub-account and one-time owner credentials.
type CreateResult struct {
	Account           *models.Account `json:"account"`
	OwnerEmail        string          `json:"owner_email"`
	TemporaryPassword string          `json:"temporary_password"`
}

func (s *Service) Create(ctx context.Context, parentID uuid.UUID, name, ownerEmail, ownerName string) (*CreateResult, error) {
	name = strings.TrimSpace(name)
	ownerEmail = strings.ToLower(strings.TrimSpace(ownerEmail))
	ownerName = strings.TrimSpace(ownerName)
	if name == "" {
		return nil, fmt.Errorf("subaccounts.Create: %w: workspace name is required", ErrValidation)
	}
	if ownerEmail == "" || ownerName == "" {
		return nil, fmt.Errorf("subaccounts.Create: %w: owner name and email are required", ErrValidation)
	}

	if exists, err := s.repo.EmailExists(ctx, ownerEmail); err != nil {
		return nil, err
	} else if exists {
		return nil, ErrEmailTaken
	}

	tempPassword, err := genPassword()
	if err != nil {
		return nil, fmt.Errorf("subaccounts.Create: %w", err)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(tempPassword), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("subaccounts.Create: hash: %w", err)
	}

	acc, _, err := s.repo.CreateSubAccount(ctx, parentID, name, ownerName, ownerEmail, string(hash), trialDays)
	if err != nil {
		return nil, err
	}
	return &CreateResult{Account: acc, OwnerEmail: ownerEmail, TemporaryPassword: tempPassword}, nil
}

func (s *Service) List(ctx context.Context, parentID uuid.UUID) ([]SubAccount, error) {
	return s.repo.ListSubAccounts(ctx, parentID)
}

// Switch authorizes the caller's parent account over subID and returns a fresh
// session (tokens) for the sub-account's owner, so the agency operator can act
// inside the client workspace without a separate login.
func (s *Service) Switch(ctx context.Context, parentID, subID uuid.UUID) (*auth.AuthResult, error) {
	ok, err := s.repo.IsChildOf(ctx, parentID, subID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrForbidden
	}
	owner, err := s.repo.GetOwner(ctx, subID)
	if err != nil {
		return nil, err
	}
	return s.authSvc.IssueFor(ctx, owner)
}

func genPassword() (string, error) {
	b := make([]byte, 9)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
