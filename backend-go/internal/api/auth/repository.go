package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"crm-go-api/internal/models"
)

// ErrUserNotFound is returned when no user matches the lookup.
var ErrUserNotFound = errors.New("user not found")

// ErrRefreshTokenNotFound is returned when a refresh token is missing/revoked/expired.
var ErrRefreshTokenNotFound = errors.New("refresh token not found")

// RefreshToken is a stored, hashed login session.
type RefreshToken struct {
	ID        uuid.UUID
	AccountID uuid.UUID
	UserID    uuid.UUID
	ExpiresAt time.Time
	RevokedAt *time.Time
}

// Repository owns all auth-related database access. Unlike tenant repositories,
// register/login run before an account_id exists, so these queries are the
// single documented exception to account-scoped access.
type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// CreateAccountAndOwner creates an account and its first (owner) user atomically.
func (r *Repository) CreateAccountAndOwner(ctx context.Context, accountName, userName, email, passwordHash string, trialDays int) (*models.Account, *models.User, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("CreateAccountAndOwner: begin: %w", err)
	}
	defer tx.Rollback(ctx)

	var acc models.Account
	err = tx.QueryRow(ctx,
		`INSERT INTO accounts (name, plan, trial_ends_at)
		 VALUES ($1, 'trial', NOW() + make_interval(days => $2))
		 RETURNING id, name, plan, trial_ends_at, stripe_customer_id, stripe_subscription_id, timezone, created_at, updated_at`,
		accountName, trialDays,
	).Scan(&acc.ID, &acc.Name, &acc.Plan, &acc.TrialEndsAt, &acc.StripeCustomerID, &acc.StripeSubscriptionID, &acc.Timezone, &acc.CreatedAt, &acc.UpdatedAt)
	if err != nil {
		return nil, nil, fmt.Errorf("CreateAccountAndOwner: insert account: %w", err)
	}

	var u models.User
	err = tx.QueryRow(ctx,
		`INSERT INTO users (account_id, email, password_hash, name, role)
		 VALUES ($1, $2, $3, $4, 'owner')
		 RETURNING id, account_id, email, password_hash, name, role, avatar_url, timezone, is_active, created_at, updated_at`,
		acc.ID, email, passwordHash, userName,
	).Scan(&u.ID, &u.AccountID, &u.Email, &u.PasswordHash, &u.Name, &u.Role, &u.AvatarURL, &u.Timezone, &u.IsActive, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, nil, fmt.Errorf("CreateAccountAndOwner: insert user: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, nil, fmt.Errorf("CreateAccountAndOwner: commit: %w", err)
	}
	return &acc, &u, nil
}

// GetUserByEmail looks up a user by email for login.
func (r *Repository) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	var u models.User
	err := r.db.QueryRow(ctx,
		`SELECT id, account_id, email, password_hash, name, role, avatar_url, timezone, is_active, created_at, updated_at
		 FROM users WHERE email = $1`,
		email,
	).Scan(&u.ID, &u.AccountID, &u.Email, &u.PasswordHash, &u.Name, &u.Role, &u.AvatarURL, &u.Timezone, &u.IsActive, &u.CreatedAt, &u.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("GetUserByEmail: %w", err)
	}
	return &u, nil
}

// GetUserByID loads a user by id (used during refresh to re-read role).
func (r *Repository) GetUserByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	var u models.User
	err := r.db.QueryRow(ctx,
		`SELECT id, account_id, email, password_hash, name, role, avatar_url, timezone, is_active, created_at, updated_at
		 FROM users WHERE id = $1`,
		id,
	).Scan(&u.ID, &u.AccountID, &u.Email, &u.PasswordHash, &u.Name, &u.Role, &u.AvatarURL, &u.Timezone, &u.IsActive, &u.CreatedAt, &u.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("GetUserByID: %w", err)
	}
	return &u, nil
}

// StoreRefreshToken persists the hash of a refresh token with its expiry.
func (r *Repository) StoreRefreshToken(ctx context.Context, accountID, userID uuid.UUID, tokenHash string, expiresAt time.Time) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO refresh_tokens (account_id, user_id, token_hash, expires_at)
		 VALUES ($1, $2, $3, $4)`,
		accountID, userID, tokenHash, expiresAt,
	)
	if err != nil {
		return fmt.Errorf("StoreRefreshToken: %w", err)
	}
	return nil
}

// GetValidRefreshToken returns an active (unexpired, unrevoked) token by hash.
func (r *Repository) GetValidRefreshToken(ctx context.Context, tokenHash string) (*RefreshToken, error) {
	var t RefreshToken
	err := r.db.QueryRow(ctx,
		`SELECT id, account_id, user_id, expires_at, revoked_at
		 FROM refresh_tokens
		 WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
		tokenHash,
	).Scan(&t.ID, &t.AccountID, &t.UserID, &t.ExpiresAt, &t.RevokedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRefreshTokenNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("GetValidRefreshToken: %w", err)
	}
	return &t, nil
}

// RevokeRefreshToken marks a refresh token revoked (used during rotation/logout).
func (r *Repository) RevokeRefreshToken(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx,
		`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("RevokeRefreshToken: %w", err)
	}
	return nil
}
