package appointments

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"

	"crm-go-api/internal/api/response"
	"crm-go-api/internal/middleware"
	"crm-go-api/internal/models"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// ---- Authenticated: appointment types & appointments ----

func (h *Handler) ListTypes(w http.ResponseWriter, r *http.Request) {
	accountID, ok := middleware.AccountID(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
		return
	}
	list, err := h.svc.ListTypes(r.Context(), accountID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not list appointment types")
		return
	}
	response.JSON(w, http.StatusOK, list, map[string]interface{}{"count": len(list)})
}

func (h *Handler) CreateType(w http.ResponseWriter, r *http.Request) {
	accountID, ok := middleware.AccountID(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
		return
	}
	var t models.AppointmentType
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid JSON body")
		return
	}
	created, err := h.svc.CreateType(r.Context(), accountID, &t)
	if errors.Is(err, ErrValidation) {
		response.Error(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not create appointment type")
		return
	}
	response.JSON(w, http.StatusCreated, created, nil)
}

func (h *Handler) DeleteType(w http.ResponseWriter, r *http.Request) {
	accountID, ok := middleware.AccountID(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
		return
	}
	id, err := uuid.Parse(mux.Vars(r)["id"])
	if err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid id")
		return
	}
	if err := h.svc.DeleteType(r.Context(), accountID, id); errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "not_found", "appointment type not found")
		return
	} else if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not delete appointment type")
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"status": "deleted"}, nil)
}

func (h *Handler) ListAppointments(w http.ResponseWriter, r *http.Request) {
	accountID, ok := middleware.AccountID(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
		return
	}
	list, err := h.svc.ListAppointments(r.Context(), accountID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not list appointments")
		return
	}
	response.JSON(w, http.StatusOK, list, map[string]interface{}{"count": len(list)})
}

type statusRequest struct {
	Status string `json:"status"`
}

func (h *Handler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	accountID, ok := middleware.AccountID(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
		return
	}
	id, err := uuid.Parse(mux.Vars(r)["id"])
	if err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid id")
		return
	}
	var req statusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid JSON body")
		return
	}
	a, err := h.svc.UpdateStatus(r.Context(), accountID, id, req.Status)
	if errors.Is(err, ErrValidation) {
		response.Error(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "not_found", "appointment not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not update appointment")
		return
	}
	response.JSON(w, http.StatusOK, a, nil)
}

// ---- Public booking (no auth) ----

func (h *Handler) PublicGetType(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(mux.Vars(r)["id"])
	if err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid id")
		return
	}
	t, err := h.svc.GetPublicType(r.Context(), id)
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "not_found", "booking page not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not load booking page")
		return
	}
	response.JSON(w, http.StatusOK, t, nil)
}

func (h *Handler) PublicSlots(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(mux.Vars(r)["id"])
	if err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid id")
		return
	}
	dateStr := r.URL.Query().Get("date")
	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "date must be YYYY-MM-DD")
		return
	}
	t, slots, err := h.svc.AvailableSlots(r.Context(), id, date)
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "not_found", "booking page not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not load slots")
		return
	}
	response.JSON(w, http.StatusOK, map[string]interface{}{"appointment_type": t, "slots": slots}, nil)
}

type bookRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Phone    string `json:"phone"`
	StartsAt string `json:"starts_at"`
}

func (h *Handler) PublicBook(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(mux.Vars(r)["id"])
	if err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid id")
		return
	}
	var req bookRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid JSON body")
		return
	}
	startsAt, err := time.Parse(time.RFC3339, req.StartsAt)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "starts_at must be RFC3339")
		return
	}
	appt, err := h.svc.Book(r.Context(), id, BookInput{Name: req.Name, Email: req.Email, Phone: req.Phone, StartsAt: startsAt})
	if errors.Is(err, ErrValidation) {
		response.Error(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "not_found", "booking page not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not book appointment")
		return
	}
	response.JSON(w, http.StatusCreated, appt, nil)
}
