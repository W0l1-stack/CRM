package deals

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"crm-go-api/internal/models"
)

// ErrNotFound is returned when no deal matches within the account.
var ErrNotFound = errors.New("deal not found")

// Repository owns all deal database access, scoped by account_id.
type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

const dealColumns = `id, account_id, pipeline_id, contact_id, assigned_to, name, value,
	stage_id, probability, close_date, notes, created_at, updated_at`

func scanDeal(row pgx.Row) (*models.Deal, error) {
	var d models.Deal
	if err := row.Scan(
		&d.ID, &d.AccountID, &d.PipelineID, &d.ContactID, &d.AssignedTo, &d.Name, &d.Value,
		&d.StageID, &d.Probability, &d.CloseDate, &d.Notes, &d.CreatedAt, &d.UpdatedAt,
	); err != nil {
		return nil, err
	}
	return &d, nil
}

// List returns deals for an account, optionally filtered by pipeline.
func (r *Repository) List(ctx context.Context, accountID uuid.UUID, pipelineID *uuid.UUID) ([]models.Deal, error) {
	query := `SELECT ` + dealColumns + ` FROM deals WHERE account_id = $1`
	args := []interface{}{accountID}
	if pipelineID != nil {
		args = append(args, *pipelineID)
		query += fmt.Sprintf(" AND pipeline_id = $%d", len(args))
	}
	query += " ORDER BY created_at DESC"

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("deals.List: %w", err)
	}
	defer rows.Close()

	out := []models.Deal{}
	for rows.Next() {
		d, err := scanDeal(rows)
		if err != nil {
			return nil, fmt.Errorf("deals.List: scan: %w", err)
		}
		out = append(out, *d)
	}
	return out, rows.Err()
}

func (r *Repository) GetByID(ctx context.Context, accountID, id uuid.UUID) (*models.Deal, error) {
	row := r.db.QueryRow(ctx,
		`SELECT `+dealColumns+` FROM deals WHERE account_id = $1 AND id = $2`,
		accountID, id,
	)
	d, err := scanDeal(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("deals.GetByID: %w", err)
	}
	return d, nil
}

func (r *Repository) Create(ctx context.Context, accountID uuid.UUID, d *models.Deal) (*models.Deal, error) {
	row := r.db.QueryRow(ctx,
		`INSERT INTO deals (account_id, pipeline_id, contact_id, assigned_to, name, value, stage_id, probability, close_date, notes)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		 RETURNING `+dealColumns,
		accountID, d.PipelineID, d.ContactID, d.AssignedTo, d.Name, d.Value, d.StageID, d.Probability, d.CloseDate, d.Notes,
	)
	created, err := scanDeal(row)
	if err != nil {
		return nil, fmt.Errorf("deals.Create: %w", err)
	}
	return created, nil
}

func (r *Repository) Update(ctx context.Context, accountID, id uuid.UUID, d *models.Deal) (*models.Deal, error) {
	row := r.db.QueryRow(ctx,
		`UPDATE deals
		 SET pipeline_id = $3, contact_id = $4, assigned_to = $5, name = $6, value = $7,
		     stage_id = $8, probability = $9, close_date = $10, notes = $11, updated_at = NOW()
		 WHERE account_id = $1 AND id = $2
		 RETURNING `+dealColumns,
		accountID, id, d.PipelineID, d.ContactID, d.AssignedTo, d.Name, d.Value, d.StageID, d.Probability, d.CloseDate, d.Notes,
	)
	updated, err := scanDeal(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("deals.Update: %w", err)
	}
	return updated, nil
}

func (r *Repository) Delete(ctx context.Context, accountID, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM deals WHERE account_id = $1 AND id = $2`, accountID, id)
	if err != nil {
		return fmt.Errorf("deals.Delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
