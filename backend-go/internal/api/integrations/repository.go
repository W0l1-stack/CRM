package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"crm-go-api/internal/crypto"
	"crm-go-api/internal/models"
)

// ErrNotFound is returned when no integration matches.
var ErrNotFound = errors.New("integration not found")

// Repository persists per-account provider connections, encrypting credentials
// with the shared secret so the Node sender can decrypt them.
type Repository struct {
	db     *pgxpool.Pool
	secret string
}

func NewRepository(db *pgxpool.Pool, secret string) *Repository {
	return &Repository{db: db, secret: secret}
}

// Upsert stores (or replaces) the account's provider for a kind.
func (r *Repository) Upsert(ctx context.Context, accountID uuid.UUID, kind, provider, from string, config map[string]string) error {
	raw, err := json.Marshal(config)
	if err != nil {
		return fmt.Errorf("integrations.Upsert: encode: %w", err)
	}
	enc, err := crypto.Encrypt(string(raw), r.secret)
	if err != nil {
		return fmt.Errorf("integrations.Upsert: encrypt: %w", err)
	}
	_, err = r.db.Exec(ctx,
		`INSERT INTO account_integrations (account_id, kind, provider, config_enc, from_value, is_active)
		 VALUES ($1, $2, $3, $4, $5, TRUE)
		 ON CONFLICT (account_id, kind)
		 DO UPDATE SET provider = EXCLUDED.provider, config_enc = EXCLUDED.config_enc,
		               from_value = EXCLUDED.from_value, is_active = TRUE, updated_at = NOW()`,
		accountID, kind, provider, enc, from)
	if err != nil {
		return fmt.Errorf("integrations.Upsert: %w", err)
	}
	return nil
}

// List returns the account's connections without secrets.
func (r *Repository) List(ctx context.Context, accountID uuid.UUID) ([]models.AccountIntegration, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, account_id, kind, provider, COALESCE(from_value,''), is_active, created_at, updated_at
		   FROM account_integrations WHERE account_id = $1`, accountID)
	if err != nil {
		return nil, fmt.Errorf("integrations.List: %w", err)
	}
	defer rows.Close()
	out := []models.AccountIntegration{}
	for rows.Next() {
		var it models.AccountIntegration
		if err := rows.Scan(&it.ID, &it.AccountID, &it.Kind, &it.Provider, &it.From, &it.IsActive, &it.CreatedAt, &it.UpdatedAt); err != nil {
			return nil, fmt.Errorf("integrations.List: scan: %w", err)
		}
		out = append(out, it)
	}
	return out, rows.Err()
}

// GetByKind returns the connection for a kind, decrypting its config.
func (r *Repository) GetByKind(ctx context.Context, accountID uuid.UUID, kind string) (*models.AccountIntegration, error) {
	var it models.AccountIntegration
	var enc string
	err := r.db.QueryRow(ctx,
		`SELECT id, account_id, kind, provider, config_enc, COALESCE(from_value,''), is_active, created_at, updated_at
		   FROM account_integrations WHERE account_id = $1 AND kind = $2`, accountID, kind).
		Scan(&it.ID, &it.AccountID, &it.Kind, &it.Provider, &enc, &it.From, &it.IsActive, &it.CreatedAt, &it.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("integrations.GetByKind: %w", err)
	}
	dec, err := crypto.Decrypt(enc, r.secret)
	if err != nil {
		return nil, fmt.Errorf("integrations.GetByKind: decrypt: %w", err)
	}
	_ = json.Unmarshal([]byte(dec), &it.Config)
	return &it, nil
}

func (r *Repository) Delete(ctx context.Context, accountID uuid.UUID, kind string) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM account_integrations WHERE account_id = $1 AND kind = $2`, accountID, kind)
	if err != nil {
		return fmt.Errorf("integrations.Delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
