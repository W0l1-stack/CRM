package campaigns

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

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	accountID, ok := middleware.AccountID(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
		return
	}
	list, err := h.svc.List(r.Context(), accountID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not list campaigns")
		return
	}
	response.JSON(w, http.StatusOK, list, map[string]interface{}{"count": len(list)})
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	accountID, ok := middleware.AccountID(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
		return
	}
	id, err := uuid.Parse(mux.Vars(r)["id"])
	if err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid campaign id")
		return
	}
	c, err := h.svc.Get(r.Context(), accountID, id)
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "not_found", "campaign not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not load campaign")
		return
	}
	response.JSON(w, http.StatusOK, c, nil)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	accountID, ok := middleware.AccountID(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
		return
	}
	var c models.Campaign
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid JSON body")
		return
	}
	var createdBy *uuid.UUID
	if uid, ok := middleware.UserID(r.Context()); ok {
		createdBy = &uid
	}
	created, err := h.svc.Create(r.Context(), accountID, createdBy, &c)
	if errors.Is(err, ErrValidation) {
		response.Error(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not create campaign")
		return
	}
	response.JSON(w, http.StatusCreated, created, nil)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	accountID, ok := middleware.AccountID(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
		return
	}
	id, err := uuid.Parse(mux.Vars(r)["id"])
	if err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid campaign id")
		return
	}
	var c models.Campaign
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid JSON body")
		return
	}
	updated, err := h.svc.Update(r.Context(), accountID, id, &c)
	if errors.Is(err, ErrValidation) {
		response.Error(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "not_found", "campaign not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not update campaign")
		return
	}
	response.JSON(w, http.StatusOK, updated, nil)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	accountID, ok := middleware.AccountID(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
		return
	}
	id, err := uuid.Parse(mux.Vars(r)["id"])
	if err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid campaign id")
		return
	}
	if err := h.svc.Delete(r.Context(), accountID, id); errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "not_found", "campaign not found")
		return
	} else if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not delete campaign")
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"status": "deleted"}, nil)
}

func (h *Handler) Send(w http.ResponseWriter, r *http.Request) {
	accountID, ok := middleware.AccountID(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
		return
	}
	id, err := uuid.Parse(mux.Vars(r)["id"])
	if err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid campaign id")
		return
	}
	c, err := h.svc.Send(r.Context(), accountID, id)
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "not_found", "campaign not found")
		return
	}
	if errors.Is(err, ErrAlreadySent) {
		response.Error(w, http.StatusConflict, "already_sent", "campaign is already sending or sent")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not send campaign")
		return
	}
	response.JSON(w, http.StatusOK, c, nil)
}

// Recipients handles GET /campaigns/{id}/recipients — per-contact open/click status.
func (h *Handler) Recipients(w http.ResponseWriter, r *http.Request) {
	accountID, ok := middleware.AccountID(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
		return
	}
	id, err := uuid.Parse(mux.Vars(r)["id"])
	if err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid campaign id")
		return
	}
	recipients, err := h.svc.Recipients(r.Context(), accountID, id)
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "not_found", "campaign not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not load recipients")
		return
	}
	response.JSON(w, http.StatusOK, recipients, map[string]interface{}{"count": len(recipients)})
}

type scheduleRequest struct {
	ScheduledAt string `json:"scheduled_at"`
}

func (h *Handler) Schedule(w http.ResponseWriter, r *http.Request) {
	accountID, ok := middleware.AccountID(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
		return
	}
	id, err := uuid.Parse(mux.Vars(r)["id"])
	if err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid campaign id")
		return
	}
	var req scheduleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid JSON body")
		return
	}
	at, err := time.Parse(time.RFC3339, req.ScheduledAt)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "scheduled_at must be RFC3339")
		return
	}
	c, err := h.svc.Schedule(r.Context(), accountID, id, at)
	if errors.Is(err, ErrValidation) {
		response.Error(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "not_found", "campaign not found")
		return
	}
	if errors.Is(err, ErrAlreadySent) {
		response.Error(w, http.StatusConflict, "already_sent", "campaign is already sending or sent")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not schedule campaign")
		return
	}
	response.JSON(w, http.StatusOK, c, nil)
}

// Unsubscribe is the public link target in campaign emails: /public/unsubscribe?a=<account>&c=<contact>
func (h *Handler) Unsubscribe(w http.ResponseWriter, r *http.Request) {
	accountID, err := uuid.Parse(r.URL.Query().Get("a"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid account")
		return
	}
	contactID, err := uuid.Parse(r.URL.Query().Get("c"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid contact")
		return
	}
	if err := h.svc.Unsubscribe(r.Context(), accountID, contactID); err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not unsubscribe")
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte("<html><body style=\"font-family:sans-serif;text-align:center;padding:3rem\"><h2>You're unsubscribed</h2><p>You won't receive further emails from this sender.</p></body></html>"))
}
