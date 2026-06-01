package models

import (
	"time"

	"github.com/google/uuid"
)

// AppointmentType is a bookable meeting kind (e.g. "30-min Discovery Call").
type AppointmentType struct {
	ID               uuid.UUID  `json:"id"`
	AccountID        uuid.UUID  `json:"account_id"`
	Name             string     `json:"name"`
	DurationMinutes  int        `json:"duration_minutes"`
	Description      *string    `json:"description"`
	AssignedTo       *uuid.UUID `json:"assigned_to"`
	Slug             string     `json:"slug"`
	GoogleCalendarID *string    `json:"google_calendar_id"`
	IsActive         bool       `json:"is_active"`
	CreatedAt        time.Time  `json:"created_at"`
}

// Appointment is a scheduled instance of an appointment type with a contact.
type Appointment struct {
	ID                uuid.UUID  `json:"id"`
	AccountID         uuid.UUID  `json:"account_id"`
	AppointmentTypeID *uuid.UUID `json:"appointment_type_id"`
	ContactID         *uuid.UUID `json:"contact_id"`
	AssignedTo        *uuid.UUID `json:"assigned_to"`
	StartsAt          time.Time  `json:"starts_at"`
	EndsAt            time.Time  `json:"ends_at"`
	Status            string     `json:"status"`
	Notes             *string    `json:"notes"`
	GoogleEventID     *string    `json:"google_event_id"`
	CreatedAt         time.Time  `json:"created_at"`
}
