package googlecal

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNotConnected is returned when an account has no Google integration.
var ErrNotConnected = errors.New("google calendar not connected")

// Integration holds an account's stored Google OAuth tokens + target calendar.
type Integration struct {
	AccountID    uuid.UUID `json:"account_id"`
	GoogleEmail  string    `json:"google_email"`
	CalendarID   string    `json:"calendar_id"`
	AccessToken  string    `json:"-"`
	RefreshToken string    `json:"-"`
	TokenExpiry  time.Time `json:"-"`
}

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Get(ctx context.Context, accountID uuid.UUID) (*Integration, error) {
	var it Integration
	err := r.db.QueryRow(ctx,
		`SELECT account_id, COALESCE(google_email,''), calendar_id, access_token, refresh_token, token_expiry
		   FROM google_integrations WHERE account_id = $1`, accountID).
		Scan(&it.AccountID, &it.GoogleEmail, &it.CalendarID, &it.AccessToken, &it.RefreshToken, &it.TokenExpiry)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotConnected
	}
	if err != nil {
		return nil, fmt.Errorf("googlecal.Get: %w", err)
	}
	return &it, nil
}

// Upsert stores or replaces an account's integration (on (re)connect).
func (r *Repository) Upsert(ctx context.Context, it *Integration) error {
	if it.CalendarID == "" {
		it.CalendarID = "primary"
	}
	_, err := r.db.Exec(ctx,
		`INSERT INTO google_integrations (account_id, google_email, calendar_id, access_token, refresh_token, token_expiry)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 ON CONFLICT (account_id) DO UPDATE SET
		   google_email = EXCLUDED.google_email,
		   calendar_id = EXCLUDED.calendar_id,
		   access_token = EXCLUDED.access_token,
		   refresh_token = EXCLUDED.refresh_token,
		   token_expiry = EXCLUDED.token_expiry,
		   updated_at = NOW()`,
		it.AccountID, it.GoogleEmail, it.CalendarID, it.AccessToken, it.RefreshToken, it.TokenExpiry)
	if err != nil {
		return fmt.Errorf("googlecal.Upsert: %w", err)
	}
	return nil
}

// UpdateAccessToken persists a refreshed access token + expiry.
func (r *Repository) UpdateAccessToken(ctx context.Context, accountID uuid.UUID, accessToken string, expiry time.Time) error {
	_, err := r.db.Exec(ctx,
		`UPDATE google_integrations SET access_token = $2, token_expiry = $3, updated_at = NOW() WHERE account_id = $1`,
		accountID, accessToken, expiry)
	if err != nil {
		return fmt.Errorf("googlecal.UpdateAccessToken: %w", err)
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, accountID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM google_integrations WHERE account_id = $1`, accountID)
	if err != nil {
		return fmt.Errorf("googlecal.Delete: %w", err)
	}
	return nil
}

// SetAppointmentEvent records the Google event id created for an appointment.
func (r *Repository) SetAppointmentEvent(ctx context.Context, accountID, appointmentID uuid.UUID, eventID string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE appointments SET google_event_id = $3 WHERE account_id = $1 AND id = $2`,
		accountID, appointmentID, eventID)
	if err != nil {
		return fmt.Errorf("googlecal.SetAppointmentEvent: %w", err)
	}
	return nil
}
