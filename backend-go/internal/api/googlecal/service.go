package googlecal

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"crm-go-api/internal/config"
)

// ErrNotConfigured indicates the server has no Google OAuth credentials set.
var ErrNotConfigured = errors.New("google oauth not configured")

// Service manages the Google Calendar connection and exposes the calendar-sync
// operations the appointments service depends on.
type Service struct {
	repo *Repository
	cfg  *config.Config
}

func NewService(repo *Repository, cfg *config.Config) *Service {
	return &Service{repo: repo, cfg: cfg}
}

func (s *Service) configured() bool {
	return s.cfg.GoogleClientID != "" && s.cfg.GoogleClientSecret != ""
}

// signState produces a tamper-proof state token carrying the account id, so the
// public OAuth callback can be attributed to the right tenant.
func (s *Service) signState(accountID uuid.UUID) string {
	mac := hmac.New(sha256.New, []byte(s.cfg.JWTSecret))
	mac.Write([]byte(accountID.String()))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return accountID.String() + "." + sig
}

func (s *Service) verifyState(state string) (uuid.UUID, error) {
	for i := len(state) - 1; i >= 0; i-- {
		if state[i] == '.' {
			idPart, sigPart := state[:i], state[i+1:]
			id, err := uuid.Parse(idPart)
			if err != nil {
				return uuid.Nil, fmt.Errorf("googlecal.verifyState: bad id")
			}
			mac := hmac.New(sha256.New, []byte(s.cfg.JWTSecret))
			mac.Write([]byte(idPart))
			expected := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
			if !hmac.Equal([]byte(expected), []byte(sigPart)) {
				return uuid.Nil, fmt.Errorf("googlecal.verifyState: signature mismatch")
			}
			return id, nil
		}
	}
	return uuid.Nil, fmt.Errorf("googlecal.verifyState: malformed state")
}

// AuthURL returns the Google consent URL for an account to connect.
func (s *Service) AuthURL(accountID uuid.UUID) (string, error) {
	if !s.configured() {
		return "", ErrNotConfigured
	}
	return buildAuthURL(s.cfg.GoogleClientID, s.cfg.GoogleRedirectURL, s.signState(accountID)), nil
}

// HandleCallback exchanges the code, fetches the connected email, and stores
// the integration. Returns the account id so the handler can redirect.
func (s *Service) HandleCallback(ctx context.Context, code, state string) (uuid.UUID, error) {
	if !s.configured() {
		return uuid.Nil, ErrNotConfigured
	}
	accountID, err := s.verifyState(state)
	if err != nil {
		return uuid.Nil, err
	}
	tok, err := exchangeCode(ctx, s.cfg.GoogleClientID, s.cfg.GoogleClientSecret, s.cfg.GoogleRedirectURL, code)
	if err != nil {
		return uuid.Nil, err
	}
	if tok.RefreshToken == "" {
		return uuid.Nil, fmt.Errorf("googlecal.HandleCallback: no refresh token returned (re-consent required)")
	}
	email, _ := fetchUserEmail(ctx, tok.AccessToken) // best-effort
	it := &Integration{
		AccountID:    accountID,
		GoogleEmail:  email,
		CalendarID:   "primary",
		AccessToken:  tok.AccessToken,
		RefreshToken: tok.RefreshToken,
		TokenExpiry:  time.Now().Add(time.Duration(tok.ExpiresIn) * time.Second),
	}
	if err := s.repo.Upsert(ctx, it); err != nil {
		return uuid.Nil, err
	}
	return accountID, nil
}

// Status reports whether an account is connected and to which email.
func (s *Service) Status(ctx context.Context, accountID uuid.UUID) (map[string]interface{}, error) {
	it, err := s.repo.Get(ctx, accountID)
	if errors.Is(err, ErrNotConnected) {
		return map[string]interface{}{"connected": false, "configured": s.configured()}, nil
	}
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"connected":   true,
		"configured":  s.configured(),
		"email":       it.GoogleEmail,
		"calendar_id": it.CalendarID,
	}, nil
}

func (s *Service) Disconnect(ctx context.Context, accountID uuid.UUID) error {
	return s.repo.Delete(ctx, accountID)
}

// accessToken returns a valid access token for the account, refreshing it from
// the stored refresh token when expired (with a small safety margin).
func (s *Service) accessToken(ctx context.Context, accountID uuid.UUID) (string, string, error) {
	it, err := s.repo.Get(ctx, accountID)
	if err != nil {
		return "", "", err
	}
	if time.Now().Before(it.TokenExpiry.Add(-1 * time.Minute)) {
		return it.AccessToken, it.CalendarID, nil
	}
	tok, err := refreshAccessToken(ctx, s.cfg.GoogleClientID, s.cfg.GoogleClientSecret, it.RefreshToken)
	if err != nil {
		return "", "", err
	}
	expiry := time.Now().Add(time.Duration(tok.ExpiresIn) * time.Second)
	if err := s.repo.UpdateAccessToken(ctx, accountID, tok.AccessToken, expiry); err != nil {
		return "", "", err
	}
	return tok.AccessToken, it.CalendarID, nil
}

// ---- appointments.Calendar implementation ----

// Connected reports whether an account has a usable Google connection.
func (s *Service) Connected(ctx context.Context, accountID uuid.UUID) bool {
	if !s.configured() {
		return false
	}
	_, err := s.repo.Get(ctx, accountID)
	return err == nil
}

// FreeBusy returns busy intervals from the connected calendar. If the account
// isn't connected it returns no intervals (so slot generation is unaffected).
func (s *Service) FreeBusy(ctx context.Context, accountID uuid.UUID, from, to time.Time) ([]Interval, error) {
	token, calendarID, err := s.accessToken(ctx, accountID)
	if errors.Is(err, ErrNotConnected) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return fetchFreeBusy(ctx, token, calendarID, from, to)
}

// CreateEvent books the appointment on the connected calendar and returns the
// new event id. Returns ("", nil) when the account isn't connected.
func (s *Service) CreateEvent(ctx context.Context, accountID uuid.UUID, summary, description string, start, end time.Time, attendeeEmail string) (string, error) {
	token, calendarID, err := s.accessToken(ctx, accountID)
	if errors.Is(err, ErrNotConnected) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return insertEvent(ctx, token, calendarID, summary, description, start, end, attendeeEmail)
}
