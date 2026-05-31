package contacts

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

// ErrNotFound is returned when no contact matches within the account.
var ErrNotFound = errors.New("contact not found")

// Repository owns all contact database access. Every method takes accountID as
// its second parameter and filters by it — contacts never leak across tenants.
type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

const contactColumns = `id, account_id, name, email, phone, company, source, notes,
	custom_fields, tags, assigned_to, is_unsubscribed, created_at, updated_at`

// scanContact reads one row into a Contact, decoding the JSONB custom_fields.
func scanContact(row pgx.Row) (*models.Contact, error) {
	var c models.Contact
	var customRaw []byte
	if err := row.Scan(
		&c.ID, &c.AccountID, &c.Name, &c.Email, &c.Phone, &c.Company, &c.Source, &c.Notes,
		&customRaw, &c.Tags, &c.AssignedTo, &c.IsUnsubscribed, &c.CreatedAt, &c.UpdatedAt,
	); err != nil {
		return nil, err
	}
	if len(customRaw) > 0 {
		if err := json.Unmarshal(customRaw, &c.CustomFields); err != nil {
			return nil, fmt.Errorf("decode custom_fields: %w", err)
		}
	}
	if c.Tags == nil {
		c.Tags = []string{}
	}
	if c.CustomFields == nil {
		c.CustomFields = map[string]interface{}{}
	}
	return &c, nil
}

// List returns contacts for an account, optionally filtered by a search term
// (name/email/company) and a single tag.
func (r *Repository) List(ctx context.Context, accountID uuid.UUID, search, tag string) ([]models.Contact, error) {
	query := `SELECT ` + contactColumns + ` FROM contacts WHERE account_id = $1`
	args := []interface{}{accountID}

	if search != "" {
		args = append(args, "%"+search+"%")
		query += fmt.Sprintf(" AND (name ILIKE $%d OR email ILIKE $%d OR company ILIKE $%d)", len(args), len(args), len(args))
	}
	if tag != "" {
		args = append(args, tag)
		query += fmt.Sprintf(" AND $%d = ANY(tags)", len(args))
	}
	query += " ORDER BY created_at DESC"

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("contacts.List: %w", err)
	}
	defer rows.Close()

	contacts := []models.Contact{}
	for rows.Next() {
		c, err := scanContact(rows)
		if err != nil {
			return nil, fmt.Errorf("contacts.List: scan: %w", err)
		}
		contacts = append(contacts, *c)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("contacts.List: rows: %w", err)
	}
	return contacts, nil
}

// GetByID returns a single contact scoped to the account.
func (r *Repository) GetByID(ctx context.Context, accountID, id uuid.UUID) (*models.Contact, error) {
	row := r.db.QueryRow(ctx,
		`SELECT `+contactColumns+` FROM contacts WHERE account_id = $1 AND id = $2`,
		accountID, id,
	)
	c, err := scanContact(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("contacts.GetByID: %w", err)
	}
	return c, nil
}

// Create inserts a new contact for the account and returns the stored row.
func (r *Repository) Create(ctx context.Context, accountID uuid.UUID, c *models.Contact) (*models.Contact, error) {
	customJSON, err := json.Marshal(orEmptyMap(c.CustomFields))
	if err != nil {
		return nil, fmt.Errorf("contacts.Create: encode custom_fields: %w", err)
	}

	row := r.db.QueryRow(ctx,
		`INSERT INTO contacts (account_id, name, email, phone, company, source, notes, custom_fields, tags, assigned_to, is_unsubscribed)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
		 RETURNING `+contactColumns,
		accountID, c.Name, c.Email, c.Phone, c.Company, c.Source, c.Notes, string(customJSON), orEmptySlice(c.Tags), c.AssignedTo, c.IsUnsubscribed,
	)
	created, err := scanContact(row)
	if err != nil {
		return nil, fmt.Errorf("contacts.Create: %w", err)
	}
	return created, nil
}

// Update modifies an existing contact scoped to the account.
func (r *Repository) Update(ctx context.Context, accountID, id uuid.UUID, c *models.Contact) (*models.Contact, error) {
	customJSON, err := json.Marshal(orEmptyMap(c.CustomFields))
	if err != nil {
		return nil, fmt.Errorf("contacts.Update: encode custom_fields: %w", err)
	}

	row := r.db.QueryRow(ctx,
		`UPDATE contacts
		 SET name = $3, email = $4, phone = $5, company = $6, source = $7, notes = $8,
		     custom_fields = $9::jsonb, tags = $10, assigned_to = $11, is_unsubscribed = $12,
		     updated_at = NOW()
		 WHERE account_id = $1 AND id = $2
		 RETURNING `+contactColumns,
		accountID, id, c.Name, c.Email, c.Phone, c.Company, c.Source, c.Notes,
		string(customJSON), orEmptySlice(c.Tags), c.AssignedTo, c.IsUnsubscribed,
	)
	updated, err := scanContact(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("contacts.Update: %w", err)
	}
	return updated, nil
}

// Delete removes a contact scoped to the account.
func (r *Repository) Delete(ctx context.Context, accountID, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM contacts WHERE account_id = $1 AND id = $2`, accountID, id)
	if err != nil {
		return fmt.Errorf("contacts.Delete: %w", err)
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

func orEmptySlice(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
