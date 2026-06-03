package subaccounts

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

var (
	ErrNotFound   = errors.New("sub-account not found")
	ErrEmailTaken = errors.New("email already registered")
)

// SubAccount is a child workspace summary shown on the agency dashboard.
type SubAccount struct {
	ID           uuid.UUID `json:"id"`
	Name         string    `json:"name"`
	Plan         string    `json:"plan"`
	ContactCount int       `json:"contact_count"`
	UserCount    int       `json:"user_count"`
	CreatedAt    time.Time `json:"created_at"`
}

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) EmailExists(ctx context.Context, email string) (bool, error) {
	var exists bool
	if err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)`, email).Scan(&exists); err != nil {
		return false, fmt.Errorf("subaccounts.EmailExists: %w", err)
	}
	return exists, nil
}

// CreateSubAccount creates a child account under parentID plus its owner user,
// atomically. organization_id groups the agency: the parent's org id (or the
// parent's own id if it has none yet) is propagated to the child.
func (r *Repository) CreateSubAccount(ctx context.Context, parentID uuid.UUID, accountName, ownerName, ownerEmail, passwordHash string, trialDays int) (*models.Account, *models.User, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("subaccounts.CreateSubAccount: begin: %w", err)
	}
	defer tx.Rollback(ctx)

	var acc models.Account
	err = tx.QueryRow(ctx,
		`INSERT INTO accounts (name, plan, trial_ends_at, parent_account_id, organization_id)
		 VALUES ($1, 'trial', NOW() + make_interval(days => $2), $3,
		         COALESCE((SELECT COALESCE(organization_id, id) FROM accounts WHERE id = $3), $3))
		 RETURNING id, name, plan, trial_ends_at, stripe_customer_id, stripe_subscription_id, timezone, created_at, updated_at`,
		accountName, trialDays, parentID,
	).Scan(&acc.ID, &acc.Name, &acc.Plan, &acc.TrialEndsAt, &acc.StripeCustomerID, &acc.StripeSubscriptionID, &acc.Timezone, &acc.CreatedAt, &acc.UpdatedAt)
	if err != nil {
		return nil, nil, fmt.Errorf("subaccounts.CreateSubAccount: insert account: %w", err)
	}

	var u models.User
	err = tx.QueryRow(ctx,
		`INSERT INTO users (account_id, email, password_hash, name, role)
		 VALUES ($1, $2, $3, $4, 'owner')
		 RETURNING id, account_id, email, password_hash, name, role, avatar_url, timezone, is_active, created_at, updated_at`,
		acc.ID, ownerEmail, passwordHash, ownerName,
	).Scan(&u.ID, &u.AccountID, &u.Email, &u.PasswordHash, &u.Name, &u.Role, &u.AvatarURL, &u.Timezone, &u.IsActive, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, nil, fmt.Errorf("subaccounts.CreateSubAccount: insert user: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, nil, fmt.Errorf("subaccounts.CreateSubAccount: commit: %w", err)
	}
	return &acc, &u, nil
}

// ListSubAccounts returns the children of a parent account with light counts.
func (r *Repository) ListSubAccounts(ctx context.Context, parentID uuid.UUID) ([]SubAccount, error) {
	rows, err := r.db.Query(ctx,
		`SELECT a.id, a.name, a.plan, a.created_at,
		        (SELECT COUNT(*) FROM contacts c WHERE c.account_id = a.id),
		        (SELECT COUNT(*) FROM users u WHERE u.account_id = a.id AND u.is_active)
		   FROM accounts a
		  WHERE a.parent_account_id = $1
		  ORDER BY a.created_at DESC`,
		parentID)
	if err != nil {
		return nil, fmt.Errorf("subaccounts.ListSubAccounts: %w", err)
	}
	defer rows.Close()
	out := []SubAccount{}
	for rows.Next() {
		var s SubAccount
		if err := rows.Scan(&s.ID, &s.Name, &s.Plan, &s.CreatedAt, &s.ContactCount, &s.UserCount); err != nil {
			return nil, fmt.Errorf("subaccounts.ListSubAccounts: scan: %w", err)
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// IsChildOf reports whether subID is a sub-account of parentID.
func (r *Repository) IsChildOf(ctx context.Context, parentID, subID uuid.UUID) (bool, error) {
	var ok bool
	err := r.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM accounts WHERE id = $1 AND parent_account_id = $2)`,
		subID, parentID).Scan(&ok)
	if err != nil {
		return false, fmt.Errorf("subaccounts.IsChildOf: %w", err)
	}
	return ok, nil
}

// GetOwner returns an active owner user of an account (used to mint a session
// when an agency owner switches into a sub-account).
func (r *Repository) GetOwner(ctx context.Context, accountID uuid.UUID) (*models.User, error) {
	var u models.User
	err := r.db.QueryRow(ctx,
		`SELECT id, account_id, email, password_hash, name, role, avatar_url, timezone, is_active, created_at, updated_at
		   FROM users WHERE account_id = $1 AND role = 'owner' AND is_active = TRUE
		  ORDER BY created_at ASC LIMIT 1`,
		accountID,
	).Scan(&u.ID, &u.AccountID, &u.Email, &u.PasswordHash, &u.Name, &u.Role, &u.AvatarURL, &u.Timezone, &u.IsActive, &u.CreatedAt, &u.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("subaccounts.GetOwner: %w", err)
	}
	return &u, nil
}
