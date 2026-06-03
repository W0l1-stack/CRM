package automations

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"crm-go-api/internal/models"
)

// ErrNotFound is returned when no automation matches within the account.
var ErrNotFound = errors.New("automation not found")

// Repository owns automation database access, scoped by account_id.
type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

const cols = `id, account_id, name, is_active, trigger_types, trigger_config, actions, created_at, updated_at`

func scan(row pgx.Row) (*models.Automation, error) {
	var a models.Automation
	var triggerRaw, actionsRaw []byte
	if err := row.Scan(
		&a.ID, &a.AccountID, &a.Name, &a.IsActive, &a.TriggerTypes, &triggerRaw, &actionsRaw, &a.CreatedAt, &a.UpdatedAt,
	); err != nil {
		return nil, err
	}
	if a.TriggerTypes == nil {
		a.TriggerTypes = []string{}
	}
	if len(triggerRaw) > 0 {
		_ = json.Unmarshal(triggerRaw, &a.TriggerConfig)
	}
	if len(actionsRaw) > 0 {
		if err := json.Unmarshal(actionsRaw, &a.Actions); err != nil {
			return nil, fmt.Errorf("decode actions: %w", err)
		}
	}
	if a.TriggerConfig == nil {
		a.TriggerConfig = map[string]interface{}{}
	}
	if a.Actions == nil {
		a.Actions = []models.AutomationAction{}
	}
	return &a, nil
}

func (r *Repository) List(ctx context.Context, accountID uuid.UUID) ([]models.Automation, error) {
	rows, err := r.db.Query(ctx, `SELECT `+cols+` FROM automations WHERE account_id = $1 ORDER BY created_at DESC`, accountID)
	if err != nil {
		return nil, fmt.Errorf("automations.List: %w", err)
	}
	defer rows.Close()
	out := []models.Automation{}
	for rows.Next() {
		a, err := scan(rows)
		if err != nil {
			return nil, fmt.Errorf("automations.List: scan: %w", err)
		}
		out = append(out, *a)
	}
	return out, rows.Err()
}

func (r *Repository) GetByID(ctx context.Context, accountID, id uuid.UUID) (*models.Automation, error) {
	row := r.db.QueryRow(ctx, `SELECT `+cols+` FROM automations WHERE account_id = $1 AND id = $2`, accountID, id)
	a, err := scan(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("automations.GetByID: %w", err)
	}
	return a, nil
}

// ListActiveByTrigger returns active automations that fire on the given trigger
// type — used by the engine. Matches when the trigger is one of the
// automation's trigger_types. Scoped by account_id.
func (r *Repository) ListActiveByTrigger(ctx context.Context, accountID uuid.UUID, triggerType string) ([]models.Automation, error) {
	rows, err := r.db.Query(ctx,
		`SELECT `+cols+` FROM automations WHERE account_id = $1 AND is_active = TRUE AND $2 = ANY(trigger_types)`,
		accountID, triggerType)
	if err != nil {
		return nil, fmt.Errorf("automations.ListActiveByTrigger: %w", err)
	}
	defer rows.Close()
	out := []models.Automation{}
	for rows.Next() {
		a, err := scan(rows)
		if err != nil {
			return nil, fmt.Errorf("automations.ListActiveByTrigger: scan: %w", err)
		}
		out = append(out, *a)
	}
	return out, rows.Err()
}

func (r *Repository) Create(ctx context.Context, accountID uuid.UUID, a *models.Automation) (*models.Automation, error) {
	triggerJSON, _ := json.Marshal(orEmptyMap(a.TriggerConfig))
	actionsJSON, err := json.Marshal(orEmptyActions(a.Actions))
	if err != nil {
		return nil, fmt.Errorf("automations.Create: encode actions: %w", err)
	}
	row := r.db.QueryRow(ctx,
		`INSERT INTO automations (account_id, name, is_active, trigger_types, trigger_config, actions)
		 VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb) RETURNING `+cols,
		accountID, a.Name, a.IsActive, orEmptyTriggers(a.TriggerTypes), string(triggerJSON), string(actionsJSON))
	created, err := scan(row)
	if err != nil {
		return nil, fmt.Errorf("automations.Create: %w", err)
	}
	return created, nil
}

func (r *Repository) Update(ctx context.Context, accountID, id uuid.UUID, a *models.Automation) (*models.Automation, error) {
	triggerJSON, _ := json.Marshal(orEmptyMap(a.TriggerConfig))
	actionsJSON, err := json.Marshal(orEmptyActions(a.Actions))
	if err != nil {
		return nil, fmt.Errorf("automations.Update: encode actions: %w", err)
	}
	row := r.db.QueryRow(ctx,
		`UPDATE automations SET name = $3, is_active = $4, trigger_types = $5,
		   trigger_config = $6::jsonb, actions = $7::jsonb, updated_at = NOW()
		 WHERE account_id = $1 AND id = $2 RETURNING `+cols,
		accountID, id, a.Name, a.IsActive, orEmptyTriggers(a.TriggerTypes), string(triggerJSON), string(actionsJSON))
	updated, err := scan(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("automations.Update: %w", err)
	}
	return updated, nil
}

func (r *Repository) Delete(ctx context.Context, accountID, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM automations WHERE account_id = $1 AND id = $2`, accountID, id)
	if err != nil {
		return fmt.Errorf("automations.Delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func orEmptyMap(m map[string]interface{}) map[string]interface{} {
	if m == nil {
		return map[string]interface{}{}
	}
	return m
}

func orEmptyActions(a []models.AutomationAction) []models.AutomationAction {
	if a == nil {
		return []models.AutomationAction{}
	}
	return a
}

func orEmptyTriggers(t []string) []string {
	if t == nil {
		return []string{}
	}
	return t
}
