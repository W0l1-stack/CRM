package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"crm-go-api/internal/models"
	"crm-go-api/internal/token"
)

// Public errors the handler maps to HTTP status codes.
var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrEmailTaken         = errors.New("email already registered")
	ErrValidation         = errors.New("validation failed")
)

const trialDays = 14

// Tokens is the access/refresh pair returned to clients on auth success.
type Tokens struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"` // access token lifetime in seconds
}

// AuthResult bundles the authenticated user with freshly issued tokens.
type AuthResult struct {
	User   *models.User `json:"user"`
	Tokens Tokens       `json:"tokens"`
}

// Service holds auth business logic: hashing, token issuance, rotation.
type Service struct {
	repo            *Repository
	jwtSecret       string
	accessTokenTTL  time.Duration
	refreshTokenTTL time.Duration
}

func NewService(repo *Repository, jwtSecret string, accessTTL, refreshTTL time.Duration) *Service {
	return &Service{repo: repo, jwtSecret: jwtSecret, accessTokenTTL: accessTTL, refreshTokenTTL: refreshTTL}
}

// RegisterInput is the payload for creating a new account + owner user.
type RegisterInput struct {
	AccountName string
	Name        string
	Email       string
	Password    string
}

// Register creates a new account, its owner user, and returns auth tokens.
func (s *Service) Register(ctx context.Context, in RegisterInput) (*AuthResult, error) {
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	in.Name = strings.TrimSpace(in.Name)
	in.AccountName = strings.TrimSpace(in.AccountName)

	if in.Email == "" || in.Name == "" || in.AccountName == "" {
		return nil, fmt.Errorf("Register: %w: account name, name and email are required", ErrValidation)
	}
	if len(in.Password) < 8 {
		return nil, fmt.Errorf("Register: %w: password must be at least 8 characters", ErrValidation)
	}

	if existing, err := s.repo.GetUserByEmail(ctx, in.Email); err == nil && existing != nil {
		return nil, ErrEmailTaken
	} else if err != nil && !errors.Is(err, ErrUserNotFound) {
		return nil, fmt.Errorf("Register: %w", err)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("Register: hash password: %w", err)
	}

	_, user, err := s.repo.CreateAccountAndOwner(ctx, in.AccountName, in.Name, in.Email, string(hash), trialDays)
	if err != nil {
		return nil, fmt.Errorf("Register: %w", err)
	}

	tokens, err := s.issueTokens(ctx, user)
	if err != nil {
		return nil, fmt.Errorf("Register: %w", err)
	}
	return &AuthResult{User: user, Tokens: tokens}, nil
}

// Login verifies credentials and returns auth tokens.
func (s *Service) Login(ctx context.Context, email, password string) (*AuthResult, error) {
	email = strings.ToLower(strings.TrimSpace(email))

	user, err := s.repo.GetUserByEmail(ctx, email)
	if errors.Is(err, ErrUserNotFound) {
		// Run a dummy compare to keep timing roughly constant.
		_ = bcrypt.CompareHashAndPassword([]byte("$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali"), []byte(password))
		return nil, ErrInvalidCredentials
	}
	if err != nil {
		return nil, fmt.Errorf("Login: %w", err)
	}
	if !user.IsActive {
		return nil, ErrInvalidCredentials
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	tokens, err := s.issueTokens(ctx, user)
	if err != nil {
		return nil, fmt.Errorf("Login: %w", err)
	}
	return &AuthResult{User: user, Tokens: tokens}, nil
}

// Refresh rotates a refresh token: it validates the old one, revokes it, and
// issues a fresh access/refresh pair.
func (s *Service) Refresh(ctx context.Context, rawRefreshToken string) (*AuthResult, error) {
	rawRefreshToken = strings.TrimSpace(rawRefreshToken)
	if rawRefreshToken == "" {
		return nil, ErrInvalidCredentials
	}

	hash := token.HashRefreshToken(rawRefreshToken)
	stored, err := s.repo.GetValidRefreshToken(ctx, hash)
	if errors.Is(err, ErrRefreshTokenNotFound) {
		return nil, ErrInvalidCredentials
	}
	if err != nil {
		return nil, fmt.Errorf("Refresh: %w", err)
	}

	if err := s.repo.RevokeRefreshToken(ctx, stored.ID); err != nil {
		return nil, fmt.Errorf("Refresh: %w", err)
	}

	user, err := s.repo.GetUserByID(ctx, stored.UserID)
	if err != nil {
		return nil, fmt.Errorf("Refresh: %w", err)
	}

	tokens, err := s.issueTokens(ctx, user)
	if err != nil {
		return nil, fmt.Errorf("Refresh: %w", err)
	}
	return &AuthResult{User: user, Tokens: tokens}, nil
}

// IssueFor mints a fresh access/refresh pair for a user without a password
// check. Callers must authorize the caller separately (e.g. an agency owner
// switching into a sub-account they own).
func (s *Service) IssueFor(ctx context.Context, user *models.User) (*AuthResult, error) {
	tokens, err := s.issueTokens(ctx, user)
	if err != nil {
		return nil, fmt.Errorf("IssueFor: %w", err)
	}
	return &AuthResult{User: user, Tokens: tokens}, nil
}

// issueTokens signs an access token and stores a new refresh token.
func (s *Service) issueTokens(ctx context.Context, user *models.User) (Tokens, error) {
	access, err := token.IssueAccessToken(s.jwtSecret, user.AccountID, user.ID, user.Role, s.accessTokenTTL)
	if err != nil {
		return Tokens{}, err
	}

	rawRefresh, refreshHash, err := token.GenerateRefreshToken()
	if err != nil {
		return Tokens{}, err
	}
	if err := s.repo.StoreRefreshToken(ctx, user.AccountID, user.ID, refreshHash, time.Now().Add(s.refreshTokenTTL)); err != nil {
		return Tokens{}, err
	}

	return Tokens{
		AccessToken:  access,
		RefreshToken: rawRefresh,
		ExpiresIn:    int(s.accessTokenTTL.Seconds()),
	}, nil
}
