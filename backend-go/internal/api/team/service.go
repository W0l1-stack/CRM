package team

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"crm-go-api/internal/models"
	"crm-go-api/internal/plan"
)

var (
	ErrValidation    = errors.New("validation failed")
	ErrLastOwner     = errors.New("cannot remove or demote the last owner")
	ErrLimitReached  = plan.ErrLimitReached
)

var assignableRoles = map[string]bool{models.RoleAdmin: true, models.RoleMember: true, models.RoleOwner: true}

type Service struct {
	repo     *Repository
	enforcer *plan.Enforcer
}

func NewService(repo *Repository, enforcer *plan.Enforcer) *Service {
	return &Service{repo: repo, enforcer: enforcer}
}

func (s *Service) ListMembers(ctx context.Context, accountID uuid.UUID) ([]models.User, error) {
	return s.repo.ListUsers(ctx, accountID)
}

// InviteResult returns the new member and a one-time temporary password to share.
type InviteResult struct {
	User             *models.User `json:"user"`
	TemporaryPassword string      `json:"temporary_password"`
}

func (s *Service) Invite(ctx context.Context, accountID uuid.UUID, email, name, role string) (*InviteResult, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	name = strings.TrimSpace(name)
	if email == "" || name == "" {
		return nil, fmt.Errorf("team.Invite: %w: name and email are required", ErrValidation)
	}
	if role == "" {
		role = models.RoleMember
	}
	if role != models.RoleAdmin && role != models.RoleMember {
		return nil, fmt.Errorf("team.Invite: %w: role must be admin or member", ErrValidation)
	}

	if exists, err := s.repo.EmailExists(ctx, email); err != nil {
		return nil, err
	} else if exists {
		return nil, ErrEmailTaken
	}

	if err := s.enforcer.Check(ctx, accountID, "users"); err != nil {
		return nil, err
	}

	tempPassword, err := genPassword()
	if err != nil {
		return nil, fmt.Errorf("team.Invite: %w", err)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(tempPassword), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("team.Invite: hash: %w", err)
	}

	user, err := s.repo.CreateUser(ctx, accountID, email, name, role, string(hash))
	if err != nil {
		return nil, err
	}
	return &InviteResult{User: user, TemporaryPassword: tempPassword}, nil
}

func (s *Service) ChangeRole(ctx context.Context, accountID, userID uuid.UUID, role string) (*models.User, error) {
	if !assignableRoles[role] {
		return nil, fmt.Errorf("team.ChangeRole: %w: invalid role", ErrValidation)
	}
	// Don't allow demoting the last owner.
	if role != models.RoleOwner {
		current, err := s.repo.GetUser(ctx, accountID, userID)
		if err != nil {
			return nil, err
		}
		if current.Role == models.RoleOwner {
			owners, err := s.repo.CountActiveOwners(ctx, accountID)
			if err != nil {
				return nil, err
			}
			if owners <= 1 {
				return nil, ErrLastOwner
			}
		}
	}
	return s.repo.UpdateRole(ctx, accountID, userID, role)
}

func (s *Service) Remove(ctx context.Context, accountID, actingUserID, targetUserID uuid.UUID) error {
	if actingUserID == targetUserID {
		return fmt.Errorf("team.Remove: %w: you cannot remove yourself", ErrValidation)
	}
	target, err := s.repo.GetUser(ctx, accountID, targetUserID)
	if err != nil {
		return err
	}
	if target.Role == models.RoleOwner {
		owners, err := s.repo.CountActiveOwners(ctx, accountID)
		if err != nil {
			return err
		}
		if owners <= 1 {
			return ErrLastOwner
		}
	}
	return s.repo.SetActive(ctx, accountID, targetUserID, false)
}

func (s *Service) Me(ctx context.Context, accountID, userID uuid.UUID) (*models.User, error) {
	return s.repo.GetUser(ctx, accountID, userID)
}

func (s *Service) UpdateProfile(ctx context.Context, accountID, userID uuid.UUID, name, timezone string, avatarURL *string) (*models.User, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, fmt.Errorf("team.UpdateProfile: %w: name is required", ErrValidation)
	}
	if timezone == "" {
		timezone = "UTC"
	}
	return s.repo.UpdateProfile(ctx, accountID, userID, name, timezone, avatarURL)
}

func (s *Service) GetAccount(ctx context.Context, accountID uuid.UUID) (*models.Account, error) {
	return s.repo.GetAccount(ctx, accountID)
}

func (s *Service) UpdateAccount(ctx context.Context, accountID uuid.UUID, name, timezone string) (*models.Account, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, fmt.Errorf("team.UpdateAccount: %w: name is required", ErrValidation)
	}
	if timezone == "" {
		timezone = "UTC"
	}
	return s.repo.UpdateAccount(ctx, accountID, name, timezone)
}

func genPassword() (string, error) {
	b := make([]byte, 9)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil // 18 hex chars
}
