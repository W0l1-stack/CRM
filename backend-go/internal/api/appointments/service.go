package appointments

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"

	"crm-go-api/internal/api/googlecal"
	"crm-go-api/internal/events"
	"crm-go-api/internal/models"
)

var ErrValidation = errors.New("validation failed")

// Business hours for slot generation (UTC for now; per-account timezone is a
// later enhancement alongside availability settings).
const (
	dayStartHour = 9
	dayEndHour   = 17
)

type Service struct {
	repo      *Repository
	publisher *events.Publisher
	cal       *googlecal.Service // nil-safe; two-way Google Calendar sync
}

func NewService(repo *Repository, publisher *events.Publisher, cal *googlecal.Service) *Service {
	return &Service{repo: repo, publisher: publisher, cal: cal}
}

// ---- Appointment types ----

func (s *Service) ListTypes(ctx context.Context, accountID uuid.UUID) ([]models.AppointmentType, error) {
	return s.repo.ListTypes(ctx, accountID)
}

func (s *Service) CreateType(ctx context.Context, accountID uuid.UUID, t *models.AppointmentType) (*models.AppointmentType, error) {
	t.Name = strings.TrimSpace(t.Name)
	if t.Name == "" {
		return nil, fmt.Errorf("appointments.CreateType: %w: name is required", ErrValidation)
	}
	if t.DurationMinutes <= 0 {
		t.DurationMinutes = 30
	}
	if strings.TrimSpace(t.Slug) == "" {
		t.Slug = slugify(t.Name) + "-" + uuid.NewString()[:8]
	}
	if !t.IsActive {
		t.IsActive = true
	}
	return s.repo.CreateType(ctx, accountID, t)
}

func (s *Service) DeleteType(ctx context.Context, accountID, id uuid.UUID) error {
	return s.repo.DeleteType(ctx, accountID, id)
}

// ---- Appointments ----

func (s *Service) ListAppointments(ctx context.Context, accountID uuid.UUID) ([]models.Appointment, error) {
	return s.repo.ListAppointments(ctx, accountID)
}

func (s *Service) UpdateStatus(ctx context.Context, accountID, id uuid.UUID, status string) (*models.Appointment, error) {
	valid := map[string]bool{"scheduled": true, "completed": true, "cancelled": true, "no_show": true}
	if !valid[status] {
		return nil, fmt.Errorf("appointments.UpdateStatus: %w: invalid status", ErrValidation)
	}
	return s.repo.UpdateStatus(ctx, accountID, id, status)
}

// ---- Public booking ----

func (s *Service) GetPublicType(ctx context.Context, id uuid.UUID) (*models.AppointmentType, error) {
	return s.repo.GetPublicType(ctx, id)
}

// AvailableSlots returns open start times for a type on a given date (UTC).
func (s *Service) AvailableSlots(ctx context.Context, id uuid.UUID, date time.Time) (*models.AppointmentType, []time.Time, error) {
	t, err := s.repo.GetPublicType(ctx, id)
	if err != nil {
		return nil, nil, err
	}

	// Generate slots within business hours in the account's timezone.
	loc := time.UTC
	if tzName, err := s.repo.AccountTimezone(ctx, t.AccountID); err == nil {
		if l, err := time.LoadLocation(tzName); err == nil {
			loc = l
		}
	}
	dayStart := time.Date(date.Year(), date.Month(), date.Day(), dayStartHour, 0, 0, 0, loc)
	dayEnd := time.Date(date.Year(), date.Month(), date.Day(), dayEndHour, 0, 0, 0, loc)

	taken, err := s.repo.AppointmentsBetween(ctx, t.AccountID, t.ID, dayStart, dayEnd)
	if err != nil {
		return nil, nil, err
	}
	takenSet := make(map[int64]bool, len(taken))
	for _, a := range taken {
		takenSet[a.StartsAt.UTC().Unix()] = true
	}

	// Pull busy intervals from the connected Google Calendar (if any) so a slot
	// the user is already booked for elsewhere isn't offered. Failures are
	// non-fatal — we fall back to DB-only availability.
	var busy []googlecal.Interval
	if s.cal != nil {
		if b, err := s.cal.FreeBusy(ctx, t.AccountID, dayStart, dayEnd); err == nil {
			busy = b
		}
	}

	step := time.Duration(t.DurationMinutes) * time.Minute
	slots := []time.Time{}
	for slot := dayStart; slot.Add(step).Compare(dayEnd) <= 0; slot = slot.Add(step) {
		if takenSet[slot.Unix()] {
			continue
		}
		slotEnd := slot.Add(step)
		if overlapsBusy(slot, slotEnd, busy) {
			continue
		}
		slots = append(slots, slot)
	}
	return t, slots, nil
}

// overlapsBusy reports whether [start,end) intersects any busy interval.
func overlapsBusy(start, end time.Time, busy []googlecal.Interval) bool {
	for _, b := range busy {
		if start.Before(b.End) && end.After(b.Start) {
			return true
		}
	}
	return false
}

// BookInput is a public booking request.
type BookInput struct {
	Name     string
	Email    string
	Phone    string
	StartsAt time.Time
}

// Book creates a contact (if new) and an appointment for a public type, then
// fires the appointment_booked trigger so confirmations/reminders can run.
func (s *Service) Book(ctx context.Context, typeID uuid.UUID, in BookInput) (*models.Appointment, error) {
	in.Name = strings.TrimSpace(in.Name)
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	if in.Name == "" || in.Email == "" {
		return nil, fmt.Errorf("appointments.Book: %w: name and email are required", ErrValidation)
	}
	if in.StartsAt.IsZero() {
		return nil, fmt.Errorf("appointments.Book: %w: starts_at is required", ErrValidation)
	}

	t, err := s.repo.GetPublicType(ctx, typeID)
	if err != nil {
		return nil, err
	}

	contactID, err := s.repo.FindOrCreateContact(ctx, t.AccountID, in.Name, in.Email, in.Phone)
	if err != nil {
		return nil, err
	}

	endsAt := in.StartsAt.Add(time.Duration(t.DurationMinutes) * time.Minute)
	appt := &models.Appointment{
		AppointmentTypeID: &t.ID,
		ContactID:         &contactID,
		AssignedTo:        t.AssignedTo,
		StartsAt:          in.StartsAt,
		EndsAt:            endsAt,
		Status:            "scheduled",
	}
	created, err := s.repo.CreateAppointment(ctx, t.AccountID, appt)
	if err != nil {
		return nil, err
	}

	// Two-way sync: mirror the booking onto the connected Google Calendar so the
	// slot is blocked there too. Best-effort — a sync failure must not fail the
	// booking the customer just made.
	if s.cal != nil {
		summary := t.Name + " with " + in.Name
		desc := "Booked via Lydia CRM"
		if eventID, cerr := s.cal.CreateEvent(ctx, t.AccountID, summary, desc, created.StartsAt, created.EndsAt, in.Email); cerr == nil && eventID != "" {
			_ = s.repo.SetGoogleEvent(ctx, t.AccountID, created.ID, eventID)
			created.GoogleEventID = &eventID
		}
	}

	_ = s.publisher.PublishTrigger(ctx, t.AccountID, models.TriggerAppointmentBooked, map[string]interface{}{
		"appointment": created,
		"contact":     map[string]interface{}{"id": contactID, "name": in.Name, "email": in.Email, "phone": in.Phone},
	})
	return created, nil
}

var slugRe = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = slugRe.ReplaceAllString(s, "-")
	return strings.Trim(s, "-")
}
