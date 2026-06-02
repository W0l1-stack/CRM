package forms

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

var ErrNotFound = errors.New("form not found")

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

const cols = `id, account_id, name, fields, settings, submission_count, created_at`

func scan(row pgx.Row) (*models.Form, error) {
	var f models.Form
	var fieldsRaw, settingsRaw []byte
	if err := row.Scan(&f.ID, &f.AccountID, &f.Name, &fieldsRaw, &settingsRaw, &f.SubmissionCount, &f.CreatedAt); err != nil {
		return nil, err
	}
	if len(fieldsRaw) > 0 {
		if err := json.Unmarshal(fieldsRaw, &f.Fields); err != nil {
			return nil, fmt.Errorf("decode fields: %w", err)
		}
	}
	if len(settingsRaw) > 0 {
		_ = json.Unmarshal(settingsRaw, &f.Settings)
	}
	if f.Fields == nil {
		f.Fields = []models.FormField{}
	}
	if f.Settings == nil {
		f.Settings = map[string]interface{}{}
	}
	return &f, nil
}

func (r *Repository) List(ctx context.Context, accountID uuid.UUID) ([]models.Form, error) {
	rows, err := r.db.Query(ctx, `SELECT `+cols+` FROM forms WHERE account_id = $1 ORDER BY created_at DESC`, accountID)
	if err != nil {
		return nil, fmt.Errorf("forms.List: %w", err)
	}
	defer rows.Close()
	out := []models.Form{}
	for rows.Next() {
		f, err := scan(rows)
		if err != nil {
			return nil, fmt.Errorf("forms.List: scan: %w", err)
		}
		out = append(out, *f)
	}
	return out, rows.Err()
}

func (r *Repository) GetByID(ctx context.Context, accountID, id uuid.UUID) (*models.Form, error) {
	row := r.db.QueryRow(ctx, `SELECT `+cols+` FROM forms WHERE account_id = $1 AND id = $2`, accountID, id)
	f, err := scan(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("forms.GetByID: %w", err)
	}
	return f, nil
}

// GetPublic loads a form by id without an account scope (for the public renderer).
func (r *Repository) GetPublic(ctx context.Context, id uuid.UUID) (*models.Form, error) {
	row := r.db.QueryRow(ctx, `SELECT `+cols+` FROM forms WHERE id = $1`, id)
	f, err := scan(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("forms.GetPublic: %w", err)
	}
	return f, nil
}

func (r *Repository) Create(ctx context.Context, accountID uuid.UUID, f *models.Form) (*models.Form, error) {
	fieldsJSON, err := json.Marshal(orEmptyFields(f.Fields))
	if err != nil {
		return nil, fmt.Errorf("forms.Create: encode fields: %w", err)
	}
	settingsJSON, _ := json.Marshal(orEmptyMap(f.Settings))
	row := r.db.QueryRow(ctx,
		`INSERT INTO forms (account_id, name, fields, settings) VALUES ($1, $2, $3::jsonb, $4::jsonb) RETURNING `+cols,
		accountID, f.Name, string(fieldsJSON), string(settingsJSON))
	created, err := scan(row)
	if err != nil {
		return nil, fmt.Errorf("forms.Create: %w", err)
	}
	return created, nil
}

func (r *Repository) Update(ctx context.Context, accountID, id uuid.UUID, f *models.Form) (*models.Form, error) {
	fieldsJSON, err := json.Marshal(orEmptyFields(f.Fields))
	if err != nil {
		return nil, fmt.Errorf("forms.Update: encode fields: %w", err)
	}
	settingsJSON, _ := json.Marshal(orEmptyMap(f.Settings))
	row := r.db.QueryRow(ctx,
		`UPDATE forms SET name = $3, fields = $4::jsonb, settings = $5::jsonb WHERE account_id = $1 AND id = $2 RETURNING `+cols,
		accountID, id, f.Name, string(fieldsJSON), string(settingsJSON))
	updated, err := scan(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("forms.Update: %w", err)
	}
	return updated, nil
}

func (r *Repository) Delete(ctx context.Context, accountID, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM forms WHERE account_id = $1 AND id = $2`, accountID, id)
	if err != nil {
		return fmt.Errorf("forms.Delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repository) IncrementSubmissions(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `UPDATE forms SET submission_count = submission_count + 1 WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("forms.IncrementSubmissions: %w", err)
	}
	return nil
}

// UpsertContact finds a contact by email within the account or creates one
// (source = 'form'), returning the contact id.
func (r *Repository) UpsertContact(ctx context.Context, accountID uuid.UUID, name, email, phone string) (uuid.UUID, error) {
	var id uuid.UUID
	if email != "" {
		err := r.db.QueryRow(ctx, `SELECT id FROM contacts WHERE account_id = $1 AND email = $2 LIMIT 1`, accountID, email).Scan(&id)
		if err == nil {
			return id, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return uuid.Nil, fmt.Errorf("forms.UpsertContact: lookup: %w", err)
		}
	}
	var emailPtr, phonePtr *string
	if email != "" {
		emailPtr = &email
	}
	if phone != "" {
		phonePtr = &phone
	}
	if name == "" {
		name = email
	}
	err := r.db.QueryRow(ctx,
		`INSERT INTO contacts (account_id, name, email, phone, source) VALUES ($1, $2, $3, $4, 'form') RETURNING id`,
		accountID, name, emailPtr, phonePtr).Scan(&id)
	if err != nil {
		return uuid.Nil, fmt.Errorf("forms.UpsertContact: insert: %w", err)
	}
	return id, nil
}

func orEmptyFields(f []models.FormField) []models.FormField {
	if f == nil {
		return []models.FormField{}
	}
	return f
}

func orEmptyMap(m map[string]interface{}) map[string]interface{} {
	if m == nil {
		return map[string]interface{}{}
	}
	return m
}
