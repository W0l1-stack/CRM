package appointments

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

var ErrNotFound = errors.New("not found")

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

const typeCols = `id, account_id, name, duration_minutes, description, assigned_to, slug, google_calendar_id, is_active, created_at`

func scanType(row pgx.Row) (*models.AppointmentType, error) {
	var t models.AppointmentType
	if err := row.Scan(&t.ID, &t.AccountID, &t.Name, &t.DurationMinutes, &t.Description,
		&t.AssignedTo, &t.Slug, &t.GoogleCalendarID, &t.IsActive, &t.CreatedAt); err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *Repository) ListTypes(ctx context.Context, accountID uuid.UUID) ([]models.AppointmentType, error) {
	rows, err := r.db.Query(ctx, `SELECT `+typeCols+` FROM appointment_types WHERE account_id = $1 ORDER BY created_at ASC`, accountID)
	if err != nil {
		return nil, fmt.Errorf("appointments.ListTypes: %w", err)
	}
	defer rows.Close()
	out := []models.AppointmentType{}
	for rows.Next() {
		t, err := scanType(rows)
		if err != nil {
			return nil, fmt.Errorf("appointments.ListTypes: scan: %w", err)
		}
		out = append(out, *t)
	}
	return out, rows.Err()
}

func (r *Repository) GetType(ctx context.Context, accountID, id uuid.UUID) (*models.AppointmentType, error) {
	row := r.db.QueryRow(ctx, `SELECT `+typeCols+` FROM appointment_types WHERE account_id = $1 AND id = $2`, accountID, id)
	t, err := scanType(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("appointments.GetType: %w", err)
	}
	return t, nil
}

// GetPublicType loads an active appointment type by id without an account scope
// (the public booking page only knows the type id).
func (r *Repository) GetPublicType(ctx context.Context, id uuid.UUID) (*models.AppointmentType, error) {
	row := r.db.QueryRow(ctx, `SELECT `+typeCols+` FROM appointment_types WHERE id = $1 AND is_active = TRUE`, id)
	t, err := scanType(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("appointments.GetPublicType: %w", err)
	}
	return t, nil
}

func (r *Repository) CreateType(ctx context.Context, accountID uuid.UUID, t *models.AppointmentType) (*models.AppointmentType, error) {
	row := r.db.QueryRow(ctx,
		`INSERT INTO appointment_types (account_id, name, duration_minutes, description, assigned_to, slug, is_active)
		 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING `+typeCols,
		accountID, t.Name, t.DurationMinutes, t.Description, t.AssignedTo, t.Slug, t.IsActive)
	created, err := scanType(row)
	if err != nil {
		return nil, fmt.Errorf("appointments.CreateType: %w", err)
	}
	return created, nil
}

func (r *Repository) DeleteType(ctx context.Context, accountID, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM appointment_types WHERE account_id = $1 AND id = $2`, accountID, id)
	if err != nil {
		return fmt.Errorf("appointments.DeleteType: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

const apptCols = `id, account_id, appointment_type_id, contact_id, assigned_to, starts_at, ends_at, status, notes, google_event_id, created_at`

func scanAppt(row pgx.Row) (*models.Appointment, error) {
	var a models.Appointment
	if err := row.Scan(&a.ID, &a.AccountID, &a.AppointmentTypeID, &a.ContactID, &a.AssignedTo,
		&a.StartsAt, &a.EndsAt, &a.Status, &a.Notes, &a.GoogleEventID, &a.CreatedAt); err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *Repository) ListAppointments(ctx context.Context, accountID uuid.UUID) ([]models.Appointment, error) {
	rows, err := r.db.Query(ctx, `SELECT `+apptCols+` FROM appointments WHERE account_id = $1 ORDER BY starts_at ASC`, accountID)
	if err != nil {
		return nil, fmt.Errorf("appointments.ListAppointments: %w", err)
	}
	defer rows.Close()
	out := []models.Appointment{}
	for rows.Next() {
		a, err := scanAppt(rows)
		if err != nil {
			return nil, fmt.Errorf("appointments.ListAppointments: scan: %w", err)
		}
		out = append(out, *a)
	}
	return out, rows.Err()
}

// AppointmentsBetween returns appointments for a type within a time window,
// used to compute which slots are already taken.
func (r *Repository) AppointmentsBetween(ctx context.Context, accountID, typeID uuid.UUID, from, to time.Time) ([]models.Appointment, error) {
	rows, err := r.db.Query(ctx,
		`SELECT `+apptCols+` FROM appointments
		  WHERE account_id = $1 AND appointment_type_id = $2 AND status != 'cancelled'
		    AND starts_at >= $3 AND starts_at < $4`,
		accountID, typeID, from, to)
	if err != nil {
		return nil, fmt.Errorf("appointments.AppointmentsBetween: %w", err)
	}
	defer rows.Close()
	out := []models.Appointment{}
	for rows.Next() {
		a, err := scanAppt(rows)
		if err != nil {
			return nil, fmt.Errorf("appointments.AppointmentsBetween: scan: %w", err)
		}
		out = append(out, *a)
	}
	return out, rows.Err()
}

func (r *Repository) CreateAppointment(ctx context.Context, accountID uuid.UUID, a *models.Appointment) (*models.Appointment, error) {
	row := r.db.QueryRow(ctx,
		`INSERT INTO appointments (account_id, appointment_type_id, contact_id, assigned_to, starts_at, ends_at, status, notes)
		 VALUES ($1, $2, $3, $4, $5, $6, COALESCE(NULLIF($7,''),'scheduled'), $8) RETURNING `+apptCols,
		accountID, a.AppointmentTypeID, a.ContactID, a.AssignedTo, a.StartsAt, a.EndsAt, a.Status, a.Notes)
	created, err := scanAppt(row)
	if err != nil {
		return nil, fmt.Errorf("appointments.CreateAppointment: %w", err)
	}
	return created, nil
}

func (r *Repository) UpdateStatus(ctx context.Context, accountID, id uuid.UUID, status string) (*models.Appointment, error) {
	row := r.db.QueryRow(ctx,
		`UPDATE appointments SET status = $3 WHERE account_id = $1 AND id = $2 RETURNING `+apptCols,
		accountID, id, status)
	a, err := scanAppt(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("appointments.UpdateStatus: %w", err)
	}
	return a, nil
}

// FindOrCreateContact resolves a booking's contact by email within the account,
// creating one (source = 'booking') if needed.
func (r *Repository) FindOrCreateContact(ctx context.Context, accountID uuid.UUID, name, email, phone string) (uuid.UUID, error) {
	var id uuid.UUID
	err := r.db.QueryRow(ctx, `SELECT id FROM contacts WHERE account_id = $1 AND email = $2 LIMIT 1`, accountID, email).Scan(&id)
	if err == nil {
		return id, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, fmt.Errorf("appointments.FindOrCreateContact: lookup: %w", err)
	}
	var phonePtr *string
	if phone != "" {
		phonePtr = &phone
	}
	err = r.db.QueryRow(ctx,
		`INSERT INTO contacts (account_id, name, email, phone, source) VALUES ($1, $2, $3, $4, 'booking') RETURNING id`,
		accountID, name, email, phonePtr).Scan(&id)
	if err != nil {
		return uuid.Nil, fmt.Errorf("appointments.FindOrCreateContact: insert: %w", err)
	}
	return id, nil
}
