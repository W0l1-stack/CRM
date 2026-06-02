package team

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"crm-go-api/internal/models"
)

var (
	ErrNotFound  = errors.New("user not found")
	ErrEmailTaken = errors.New("email already in use")
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

const userCols = `id, account_id, email, password_hash, name, role, avatar_url, timezone, is_active, created_at, updated_at`

func scanUser(row pgx.Row) (*models.User, error) {
	var u models.User
	if err := row.Scan(&u.ID, &u.AccountID, &u.Email, &u.PasswordHash, &u.Name, &u.Role,
		&u.AvatarURL, &u.Timezone, &u.IsActive, &u.CreatedAt, &u.UpdatedAt); err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *Repository) ListUsers(ctx context.Context, accountID uuid.UUID) ([]models.User, error) {
	rows, err := r.db.Query(ctx, `SELECT `+userCols+` FROM users WHERE account_id = $1 ORDER BY created_at ASC`, accountID)
	if err != nil {
		return nil, fmt.Errorf("team.ListUsers: %w", err)
	}
	defer rows.Close()
	out := []models.User{}
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, fmt.Errorf("team.ListUsers: scan: %w", err)
		}
		out = append(out, *u)
	}
	return out, rows.Err()
}

func (r *Repository) GetUser(ctx context.Context, accountID, userID uuid.UUID) (*models.User, error) {
	row := r.db.QueryRow(ctx, `SELECT `+userCols+` FROM users WHERE account_id = $1 AND id = $2`, accountID, userID)
	u, err := scanUser(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("team.GetUser: %w", err)
	}
	return u, nil
}

func (r *Repository) EmailExists(ctx context.Context, email string) (bool, error) {
	var exists bool
	if err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)`, email).Scan(&exists); err != nil {
		return false, fmt.Errorf("team.EmailExists: %w", err)
	}
	return exists, nil
}

func (r *Repository) CreateUser(ctx context.Context, accountID uuid.UUID, email, name, role, passwordHash string) (*models.User, error) {
	row := r.db.QueryRow(ctx,
		`INSERT INTO users (account_id, email, password_hash, name, role) VALUES ($1, $2, $3, $4, $5) RETURNING `+userCols,
		accountID, email, passwordHash, name, role)
	u, err := scanUser(row)
	if err != nil {
		return nil, fmt.Errorf("team.CreateUser: %w", err)
	}
	return u, nil
}

func (r *Repository) UpdateRole(ctx context.Context, accountID, userID uuid.UUID, role string) (*models.User, error) {
	row := r.db.QueryRow(ctx,
		`UPDATE users SET role = $3, updated_at = NOW() WHERE account_id = $1 AND id = $2 RETURNING `+userCols,
		accountID, userID, role)
	u, err := scanUser(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("team.UpdateRole: %w", err)
	}
	return u, nil
}

func (r *Repository) SetActive(ctx context.Context, accountID, userID uuid.UUID, active bool) error {
	tag, err := r.db.Exec(ctx, `UPDATE users SET is_active = $3, updated_at = NOW() WHERE account_id = $1 AND id = $2`, accountID, userID, active)
	if err != nil {
		return fmt.Errorf("team.SetActive: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repository) UpdateProfile(ctx context.Context, accountID, userID uuid.UUID, name, timezone string, avatarURL *string) (*models.User, error) {
	row := r.db.QueryRow(ctx,
		`UPDATE users SET name = $3, timezone = $4, avatar_url = $5, updated_at = NOW()
		 WHERE account_id = $1 AND id = $2 RETURNING `+userCols,
		accountID, userID, name, timezone, avatarURL)
	u, err := scanUser(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("team.UpdateProfile: %w", err)
	}
	return u, nil
}

// CountActiveOwners guards against removing or demoting the last owner.
func (r *Repository) CountActiveOwners(ctx context.Context, accountID uuid.UUID) (int, error) {
	var n int
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE account_id = $1 AND role = 'owner' AND is_active = TRUE`, accountID).Scan(&n); err != nil {
		return 0, fmt.Errorf("team.CountActiveOwners: %w", err)
	}
	return n, nil
}

func (r *Repository) GetAccount(ctx context.Context, accountID uuid.UUID) (*models.Account, error) {
	var a models.Account
	err := r.db.QueryRow(ctx,
		`SELECT id, name, plan, trial_ends_at, stripe_customer_id, stripe_subscription_id, timezone, created_at, updated_at
		 FROM accounts WHERE id = $1`, accountID).Scan(
		&a.ID, &a.Name, &a.Plan, &a.TrialEndsAt, &a.StripeCustomerID, &a.StripeSubscriptionID, &a.Timezone, &a.CreatedAt, &a.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("team.GetAccount: %w", err)
	}
	return &a, nil
}

func (r *Repository) UpdateAccount(ctx context.Context, accountID uuid.UUID, name, timezone string) (*models.Account, error) {
	var a models.Account
	err := r.db.QueryRow(ctx,
		`UPDATE accounts SET name = $2, timezone = $3, updated_at = NOW() WHERE id = $1
		 RETURNING id, name, plan, trial_ends_at, stripe_customer_id, stripe_subscription_id, timezone, created_at, updated_at`,
		accountID, name, timezone).Scan(
		&a.ID, &a.Name, &a.Plan, &a.TrialEndsAt, &a.StripeCustomerID, &a.StripeSubscriptionID, &a.Timezone, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("team.UpdateAccount: %w", err)
	}
	return &a, nil
}
