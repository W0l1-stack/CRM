package pipelines

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/mux"

	"crm-go-api/internal/api/response"
	"crm-go-api/internal/middleware"
	"crm-go-api/internal/models"
)

// Handler exposes the pipeline HTTP endpoints.
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
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not list pipelines")
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
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid pipeline id")
		return
	}
	p, err := h.svc.Get(r.Context(), accountID, id)
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "not_found", "pipeline not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not load pipeline")
		return
	}
	response.JSON(w, http.StatusOK, p, nil)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	accountID, ok := middleware.AccountID(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
		return
	}
	var p models.Pipeline
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid JSON body")
		return
	}
	created, err := h.svc.Create(r.Context(), accountID, &p)
	if errors.Is(err, ErrValidation) {
		response.Error(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}
	if errors.Is(err, ErrLimitReached) {
		response.Error(w, http.StatusPaymentRequired, "plan_limit", err.Error())
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not create pipeline")
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
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid pipeline id")
		return
	}
	var p models.Pipeline
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid JSON body")
		return
	}
	updated, err := h.svc.Update(r.Context(), accountID, id, &p)
	if errors.Is(err, ErrValidation) {
		response.Error(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "not_found", "pipeline not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not update pipeline")
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
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid pipeline id")
		return
	}
	if err := h.svc.Delete(r.Context(), accountID, id); errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "not_found", "pipeline not found")
		return
	} else if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not delete pipeline")
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"status": "deleted"}, nil)
}
