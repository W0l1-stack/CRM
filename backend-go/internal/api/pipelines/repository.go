package pipelines

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

// ErrNotFound is returned when no pipeline matches within the account.
var ErrNotFound = errors.New("pipeline not found")

// Repository owns all pipeline database access, scoped by account_id.
type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func scanPipeline(row pgx.Row) (*models.Pipeline, error) {
	var p models.Pipeline
	var stagesRaw []byte
	if err := row.Scan(&p.ID, &p.AccountID, &p.Name, &stagesRaw, &p.CreatedAt); err != nil {
		return nil, err
	}
	if len(stagesRaw) > 0 {
		if err := json.Unmarshal(stagesRaw, &p.Stages); err != nil {
			return nil, fmt.Errorf("decode stages: %w", err)
		}
	}
	if p.Stages == nil {
		p.Stages = []models.Stage{}
	}
	return &p, nil
}

func (r *Repository) List(ctx context.Context, accountID uuid.UUID) ([]models.Pipeline, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, account_id, name, stages, created_at FROM pipelines WHERE account_id = $1 ORDER BY created_at ASC`,
		accountID,
	)
	if err != nil {
		return nil, fmt.Errorf("pipelines.List: %w", err)
	}
	defer rows.Close()

	out := []models.Pipeline{}
	for rows.Next() {
		p, err := scanPipeline(rows)
		if err != nil {
			return nil, fmt.Errorf("pipelines.List: scan: %w", err)
		}
		out = append(out, *p)
	}
	return out, rows.Err()
}

func (r *Repository) GetByID(ctx context.Context, accountID, id uuid.UUID) (*models.Pipeline, error) {
	row := r.db.QueryRow(ctx,
		`SELECT id, account_id, name, stages, created_at FROM pipelines WHERE account_id = $1 AND id = $2`,
		accountID, id,
	)
	p, err := scanPipeline(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("pipelines.GetByID: %w", err)
	}
	return p, nil
}

func (r *Repository) Create(ctx context.Context, accountID uuid.UUID, p *models.Pipeline) (*models.Pipeline, error) {
	stagesJSON, err := json.Marshal(p.Stages)
	if err != nil {
		return nil, fmt.Errorf("pipelines.Create: encode stages: %w", err)
	}
	row := r.db.QueryRow(ctx,
		`INSERT INTO pipelines (account_id, name, stages) VALUES ($1, $2, $3::jsonb)
		 RETURNING id, account_id, name, stages, created_at`,
		accountID, p.Name, string(stagesJSON),
	)
	created, err := scanPipeline(row)
	if err != nil {
		return nil, fmt.Errorf("pipelines.Create: %w", err)
	}
	return created, nil
}

func (r *Repository) Update(ctx context.Context, accountID, id uuid.UUID, p *models.Pipeline) (*models.Pipeline, error) {
	stagesJSON, err := json.Marshal(p.Stages)
	if err != nil {
		return nil, fmt.Errorf("pipelines.Update: encode stages: %w", err)
	}
	row := r.db.QueryRow(ctx,
		`UPDATE pipelines SET name = $3, stages = $4::jsonb WHERE account_id = $1 AND id = $2
		 RETURNING id, account_id, name, stages, created_at`,
		accountID, id, p.Name, string(stagesJSON),
	)
	updated, err := scanPipeline(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("pipelines.Update: %w", err)
	}
	return updated, nil
}

// Delete removes a pipeline. Its deals are removed by the ON DELETE CASCADE
// constraint on deals.pipeline_id (migration 006).
func (r *Repository) Delete(ctx context.Context, accountID, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM pipelines WHERE account_id = $1 AND id = $2`, accountID, id)
	if err != nil {
		return fmt.Errorf("pipelines.Delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
