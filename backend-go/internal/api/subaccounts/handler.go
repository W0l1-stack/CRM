package subaccounts

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/mux"

	"crm-go-api/internal/api/response"
	"crm-go-api/internal/middleware"
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
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not list sub-accounts")
		return
	}
	response.JSON(w, http.StatusOK, list, map[string]interface{}{"count": len(list)})
}

type createRequest struct {
	Name       string `json:"name"`
	OwnerName  string `json:"owner_name"`
	OwnerEmail string `json:"owner_email"`
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	accountID, ok := middleware.AccountID(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
		return
	}
	var req createRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid JSON body")
		return
	}
	result, err := h.svc.Create(r.Context(), accountID, req.Name, req.OwnerEmail, req.OwnerName)
	switch {
	case errors.Is(err, ErrValidation):
		response.Error(w, http.StatusBadRequest, "validation_error", err.Error())
	case errors.Is(err, ErrEmailTaken):
		response.Error(w, http.StatusConflict, "email_taken", "email already in use")
	case err != nil:
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not create sub-account")
	default:
		response.JSON(w, http.StatusCreated, result, nil)
	}
}

func (h *Handler) Switch(w http.ResponseWriter, r *http.Request) {
	accountID, ok := middleware.AccountID(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
		return
	}
	subID, err := uuid.Parse(mux.Vars(r)["id"])
	if err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid sub-account id")
		return
	}
	result, err := h.svc.Switch(r.Context(), accountID, subID)
	switch {
	case errors.Is(err, ErrForbidden):
		response.Error(w, http.StatusForbidden, "forbidden", "that sub-account is not yours")
	case errors.Is(err, ErrNotFound):
		response.Error(w, http.StatusNotFound, "not_found", "sub-account has no owner")
	case err != nil:
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not switch account")
	default:
		response.JSON(w, http.StatusOK, result, nil)
	}
}
