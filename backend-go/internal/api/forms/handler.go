package forms

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
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not list forms")
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
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid form id")
		return
	}
	f, err := h.svc.Get(r.Context(), accountID, id)
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "not_found", "form not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not load form")
		return
	}
	response.JSON(w, http.StatusOK, f, nil)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	accountID, ok := middleware.AccountID(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
		return
	}
	var f models.Form
	if err := json.NewDecoder(r.Body).Decode(&f); err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid JSON body")
		return
	}
	created, err := h.svc.Create(r.Context(), accountID, &f)
	if errors.Is(err, ErrValidation) {
		response.Error(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not create form")
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
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid form id")
		return
	}
	var f models.Form
	if err := json.NewDecoder(r.Body).Decode(&f); err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid JSON body")
		return
	}
	updated, err := h.svc.Update(r.Context(), accountID, id, &f)
	if errors.Is(err, ErrValidation) {
		response.Error(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "not_found", "form not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not update form")
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
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid form id")
		return
	}
	if err := h.svc.Delete(r.Context(), accountID, id); errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "not_found", "form not found")
		return
	} else if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not delete form")
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"status": "deleted"}, nil)
}

// ---- Public (no auth) ----

func (h *Handler) PublicGet(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(mux.Vars(r)["id"])
	if err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid form id")
		return
	}
	f, err := h.svc.GetPublic(r.Context(), id)
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "not_found", "form not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not load form")
		return
	}
	// Only expose what the renderer needs.
	response.JSON(w, http.StatusOK, map[string]interface{}{
		"id": f.ID, "name": f.Name, "fields": f.Fields, "settings": f.Settings,
	}, nil)
}

type submitRequest struct {
	Values map[string]string `json:"values"`
}

func (h *Handler) PublicSubmit(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(mux.Vars(r)["id"])
	if err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid form id")
		return
	}
	var req submitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid JSON body")
		return
	}
	result, err := h.svc.Submit(r.Context(), id, req.Values)
	if errors.Is(err, ErrValidation) {
		response.Error(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "not_found", "form not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not submit form")
		return
	}
	response.JSON(w, http.StatusCreated, result, nil)
}
