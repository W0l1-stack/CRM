package billing

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"crm-go-api/internal/models"
)

var ErrNotFound = errors.New("account not found")

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

const acctCols = `id, name, plan, trial_ends_at, stripe_customer_id, stripe_subscription_id, timezone, created_at, updated_at`

func scanAccount(row pgx.Row) (*models.Account, error) {
	var a models.Account
	if err := row.Scan(&a.ID, &a.Name, &a.Plan, &a.TrialEndsAt, &a.StripeCustomerID,
		&a.StripeSubscriptionID, &a.Timezone, &a.CreatedAt, &a.UpdatedAt); err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *Repository) GetAccount(ctx context.Context, accountID uuid.UUID) (*models.Account, error) {
	row := r.db.QueryRow(ctx, `SELECT `+acctCols+` FROM accounts WHERE id = $1`, accountID)
	a, err := scanAccount(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("billing.GetAccount: %w", err)
	}
	return a, nil
}

// ActivateSubscription records the Stripe customer/subscription and sets the plan.
func (r *Repository) ActivateSubscription(ctx context.Context, accountID uuid.UUID, customerID, subscriptionID, plan string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE accounts SET stripe_customer_id = $2, stripe_subscription_id = $3, plan = $4, updated_at = NOW() WHERE id = $1`,
		accountID, customerID, subscriptionID, plan)
	if err != nil {
		return fmt.Errorf("billing.ActivateSubscription: %w", err)
	}
	return nil
}

// DowngradeByCustomer resets an account to the given plan when its subscription
// ends, located by Stripe customer id.
func (r *Repository) DowngradeByCustomer(ctx context.Context, customerID, plan string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE accounts SET plan = $2, stripe_subscription_id = NULL, updated_at = NOW() WHERE stripe_customer_id = $1`,
		customerID, plan)
	if err != nil {
		return fmt.Errorf("billing.DowngradeByCustomer: %w", err)
	}
	return nil
}
