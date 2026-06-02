package campaigns

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"crm-go-api/internal/models"
)

var ErrNotFound = errors.New("campaign not found")

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

const cols = `id, account_id, created_by, name, subject, body_html, status, scheduled_at, sent_at, recipient_filter, stats, created_at, updated_at`

func scan(row pgx.Row) (*models.Campaign, error) {
	var c models.Campaign
	var filterRaw, statsRaw []byte
	if err := row.Scan(&c.ID, &c.AccountID, &c.CreatedBy, &c.Name, &c.Subject, &c.BodyHTML,
		&c.Status, &c.ScheduledAt, &c.SentAt, &filterRaw, &statsRaw, &c.CreatedAt, &c.UpdatedAt); err != nil {
		return nil, err
	}
	if len(filterRaw) > 0 {
		_ = json.Unmarshal(filterRaw, &c.RecipientFilter)
	}
	if len(statsRaw) > 0 {
		_ = json.Unmarshal(statsRaw, &c.Stats)
	}
	if c.RecipientFilter == nil {
		c.RecipientFilter = map[string]interface{}{}
	}
	if c.Stats == nil {
		c.Stats = map[string]interface{}{}
	}
	return &c, nil
}

func (r *Repository) List(ctx context.Context, accountID uuid.UUID) ([]models.Campaign, error) {
	rows, err := r.db.Query(ctx, `SELECT `+cols+` FROM campaigns WHERE account_id = $1 ORDER BY created_at DESC`, accountID)
	if err != nil {
		return nil, fmt.Errorf("campaigns.List: %w", err)
	}
	defer rows.Close()
	out := []models.Campaign{}
	for rows.Next() {
		c, err := scan(rows)
		if err != nil {
			return nil, fmt.Errorf("campaigns.List: scan: %w", err)
		}
		out = append(out, *c)
	}
	return out, rows.Err()
}

func (r *Repository) GetByID(ctx context.Context, accountID, id uuid.UUID) (*models.Campaign, error) {
	row := r.db.QueryRow(ctx, `SELECT `+cols+` FROM campaigns WHERE account_id = $1 AND id = $2`, accountID, id)
	c, err := scan(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("campaigns.GetByID: %w", err)
	}
	return c, nil
}

func (r *Repository) Create(ctx context.Context, accountID uuid.UUID, createdBy *uuid.UUID, c *models.Campaign) (*models.Campaign, error) {
	filterJSON, _ := json.Marshal(orEmptyMap(c.RecipientFilter))
	row := r.db.QueryRow(ctx,
		`INSERT INTO campaigns (account_id, created_by, name, subject, body_html, status, scheduled_at, recipient_filter)
		 VALUES ($1, $2, $3, $4, $5, COALESCE(NULLIF($6,''),'draft'), $7, $8::jsonb) RETURNING `+cols,
		accountID, createdBy, c.Name, c.Subject, c.BodyHTML, c.Status, c.ScheduledAt, string(filterJSON))
	created, err := scan(row)
	if err != nil {
		return nil, fmt.Errorf("campaigns.Create: %w", err)
	}
	return created, nil
}

func (r *Repository) Update(ctx context.Context, accountID, id uuid.UUID, c *models.Campaign) (*models.Campaign, error) {
	filterJSON, _ := json.Marshal(orEmptyMap(c.RecipientFilter))
	row := r.db.QueryRow(ctx,
		`UPDATE campaigns SET name = $3, subject = $4, body_html = $5, scheduled_at = $6, recipient_filter = $7::jsonb, updated_at = NOW()
		 WHERE account_id = $1 AND id = $2 RETURNING `+cols,
		accountID, id, c.Name, c.Subject, c.BodyHTML, c.ScheduledAt, string(filterJSON))
	updated, err := scan(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("campaigns.Update: %w", err)
	}
	return updated, nil
}

func (r *Repository) SetStatus(ctx context.Context, accountID, id uuid.UUID, status string) error {
	tag, err := r.db.Exec(ctx, `UPDATE campaigns SET status = $3, updated_at = NOW() WHERE account_id = $1 AND id = $2`, accountID, id, status)
	if err != nil {
		return fmt.Errorf("campaigns.SetStatus: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// SetScheduled marks a campaign scheduled for a future time.
func (r *Repository) SetScheduled(ctx context.Context, accountID, id uuid.UUID, scheduledAt time.Time) error {
	tag, err := r.db.Exec(ctx,
		`UPDATE campaigns SET status = 'scheduled', scheduled_at = $3, updated_at = NOW() WHERE account_id = $1 AND id = $2`,
		accountID, id, scheduledAt)
	if err != nil {
		return fmt.Errorf("campaigns.SetScheduled: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, accountID, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM campaigns WHERE account_id = $1 AND id = $2`, accountID, id)
	if err != nil {
		return fmt.Errorf("campaigns.Delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// Unsubscribe flags a contact as unsubscribed (used by the public unsubscribe link).
func (r *Repository) Unsubscribe(ctx context.Context, accountID, contactID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `UPDATE contacts SET is_unsubscribed = TRUE, updated_at = NOW() WHERE account_id = $1 AND id = $2`, accountID, contactID)
	if err != nil {
		return fmt.Errorf("campaigns.Unsubscribe: %w", err)
	}
	return nil
}

func orEmptyMap(m map[string]interface{}) map[string]interface{} {
	if m == nil {
		return map[string]interface{}{}
	}
	return m
}
