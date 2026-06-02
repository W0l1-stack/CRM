package team

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

// isManager reports whether the caller is an owner or admin.
func isManager(r *http.Request) bool {
	role, _ := middleware.Role(r.Context())
	return role == models.RoleOwner || role == models.RoleAdmin
}

func (h *Handler) mapErr(w http.ResponseWriter, err error, action string) {
	switch {
	case errors.Is(err, ErrValidation):
		response.Error(w, http.StatusBadRequest, "validation_error", err.Error())
	case errors.Is(err, ErrEmailTaken):
		response.Error(w, http.StatusConflict, "email_taken", "email already in use")
	case errors.Is(err, ErrLastOwner):
		response.Error(w, http.StatusBadRequest, "last_owner", err.Error())
	case errors.Is(err, ErrLimitReached):
		response.Error(w, http.StatusPaymentRequired, "plan_limit", err.Error())
	case errors.Is(err, ErrNotFound):
		response.Error(w, http.StatusNotFound, "not_found", "user not found")
	default:
		response.Error(w, http.StatusInternalServerError, "internal_error", action)
	}
}

func (h *Handler) ListMembers(w http.ResponseWriter, r *http.Request) {
	accountID, _ := middleware.AccountID(r.Context())
	members, err := h.svc.ListMembers(r.Context(), accountID)
	if err != nil {
		h.mapErr(w, err, "could not list team")
		return
	}
	response.JSON(w, http.StatusOK, members, map[string]interface{}{"count": len(members)})
}

type inviteRequest struct {
	Email string `json:"email"`
	Name  string `json:"name"`
	Role  string `json:"role"`
}

func (h *Handler) Invite(w http.ResponseWriter, r *http.Request) {
	if !isManager(r) {
		response.Error(w, http.StatusForbidden, "forbidden", "only owners and admins can invite members")
		return
	}
	accountID, _ := middleware.AccountID(r.Context())
	var req inviteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid JSON body")
		return
	}
	result, err := h.svc.Invite(r.Context(), accountID, req.Email, req.Name, req.Role)
	if err != nil {
		h.mapErr(w, err, "could not invite member")
		return
	}
	response.JSON(w, http.StatusCreated, result, nil)
}

type roleRequest struct {
	Role string `json:"role"`
}

func (h *Handler) ChangeRole(w http.ResponseWriter, r *http.Request) {
	if !isManager(r) {
		response.Error(w, http.StatusForbidden, "forbidden", "only owners and admins can change roles")
		return
	}
	accountID, _ := middleware.AccountID(r.Context())
	id, err := uuid.Parse(mux.Vars(r)["id"])
	if err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid user id")
		return
	}
	var req roleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid JSON body")
		return
	}
	user, err := h.svc.ChangeRole(r.Context(), accountID, id, req.Role)
	if err != nil {
		h.mapErr(w, err, "could not change role")
		return
	}
	response.JSON(w, http.StatusOK, user, nil)
}

func (h *Handler) Remove(w http.ResponseWriter, r *http.Request) {
	if !isManager(r) {
		response.Error(w, http.StatusForbidden, "forbidden", "only owners and admins can remove members")
		return
	}
	accountID, _ := middleware.AccountID(r.Context())
	actingID, _ := middleware.UserID(r.Context())
	id, err := uuid.Parse(mux.Vars(r)["id"])
	if err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid user id")
		return
	}
	if err := h.svc.Remove(r.Context(), accountID, actingID, id); err != nil {
		h.mapErr(w, err, "could not remove member")
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"status": "removed"}, nil)
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	accountID, _ := middleware.AccountID(r.Context())
	userID, _ := middleware.UserID(r.Context())
	user, err := h.svc.Me(r.Context(), accountID, userID)
	if err != nil {
		h.mapErr(w, err, "could not load profile")
		return
	}
	response.JSON(w, http.StatusOK, user, nil)
}

type profileRequest struct {
	Name      string  `json:"name"`
	Timezone  string  `json:"timezone"`
	AvatarURL *string `json:"avatar_url"`
}

func (h *Handler) UpdateMe(w http.ResponseWriter, r *http.Request) {
	accountID, _ := middleware.AccountID(r.Context())
	userID, _ := middleware.UserID(r.Context())
	var req profileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid JSON body")
		return
	}
	user, err := h.svc.UpdateProfile(r.Context(), accountID, userID, req.Name, req.Timezone, req.AvatarURL)
	if err != nil {
		h.mapErr(w, err, "could not update profile")
		return
	}
	response.JSON(w, http.StatusOK, user, nil)
}

func (h *Handler) GetAccount(w http.ResponseWriter, r *http.Request) {
	accountID, _ := middleware.AccountID(r.Context())
	acc, err := h.svc.GetAccount(r.Context(), accountID)
	if err != nil {
		h.mapErr(w, err, "could not load account")
		return
	}
	response.JSON(w, http.StatusOK, acc, nil)
}

type accountRequest struct {
	Name     string `json:"name"`
	Timezone string `json:"timezone"`
}

func (h *Handler) UpdateAccount(w http.ResponseWriter, r *http.Request) {
	if !isManager(r) {
		response.Error(w, http.StatusForbidden, "forbidden", "only owners and admins can update the account")
		return
	}
	accountID, _ := middleware.AccountID(r.Context())
	var req accountRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid JSON body")
		return
	}
	acc, err := h.svc.UpdateAccount(r.Context(), accountID, req.Name, req.Timezone)
	if err != nil {
		h.mapErr(w, err, "could not update account")
		return
	}
	response.JSON(w, http.StatusOK, acc, nil)
}
