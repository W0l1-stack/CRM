// Package plan enforces per-plan resource quotas (CLAUDE.md pricing tiers).
package plan

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrLimitReached is returned when an account is at its plan's quota.
var ErrLimitReached = errors.New("plan limit reached")

// limits[plan][resource] = max. A plan/resource absent here means unlimited
// (e.g. the "pro" plan is unlimited for everything).
var limits = map[string]map[string]int{
	"trial":   {"contacts": 500, "users": 3, "pipelines": 1, "automations": 1},
	"starter": {"contacts": 2000, "users": 3, "pipelines": 3, "automations": 5},
}

// resource -> table (fixed whitelist; never user input, so safe to interpolate).
var tables = map[string]string{
	"contacts":    "contacts",
	"users":       "users",
	"pipelines":   "pipelines",
	"automations": "automations",
}

// Enforcer checks quotas against live row counts. A nil *Enforcer is a no-op.
type Enforcer struct {
	db *pgxpool.Pool
}

func NewEnforcer(db *pgxpool.Pool) *Enforcer {
	return &Enforcer{db: db}
}

// Check returns ErrLimitReached if creating one more `resource` would exceed
// the account's plan quota. Unknown plans/resources are treated as unlimited.
// Lookup/count errors fail open (allow) so billing config never blocks usage.
func (e *Enforcer) Check(ctx context.Context, accountID uuid.UUID, resource string) error {
	if e == nil {
		return nil
	}
	var planName string
	if err := e.db.QueryRow(ctx, `SELECT plan FROM accounts WHERE id = $1`, accountID).Scan(&planName); err != nil {
		return nil
	}
	planLimits, ok := limits[planName]
	if !ok {
		return nil // unlimited (e.g. pro)
	}
	limit, ok := planLimits[resource]
	if !ok {
		return nil
	}
	table, ok := tables[resource]
	if !ok {
		return nil
	}

	var count int
	if err := e.db.QueryRow(ctx, fmt.Sprintf(`SELECT COUNT(*) FROM %s WHERE account_id = $1`, table), accountID).Scan(&count); err != nil {
		return nil
	}
	if count >= limit {
		return fmt.Errorf("%w: the %s plan allows %d %s — upgrade for more", ErrLimitReached, planName, limit, resource)
	}
	return nil
}
