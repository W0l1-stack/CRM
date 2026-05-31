package auth

import (
	"encoding/json"
	"errors"
	"net/http"

	"crm-go-api/internal/api/response"
)

// Handler exposes the auth HTTP endpoints.
type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

type registerRequest struct {
	AccountName string `json:"account_name"`
	Name        string `json:"name"`
	Email       string `json:"email"`
	Password    string `json:"password"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// Register handles POST /api/v1/auth/register.
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid JSON body")
		return
	}

	result, err := h.svc.Register(r.Context(), RegisterInput{
		AccountName: req.AccountName,
		Name:        req.Name,
		Email:       req.Email,
		Password:    req.Password,
	})
	if err != nil {
		switch {
		case errors.Is(err, ErrValidation):
			response.Error(w, http.StatusBadRequest, "validation_error", err.Error())
		case errors.Is(err, ErrEmailTaken):
			response.Error(w, http.StatusConflict, "email_taken", "email already registered")
		default:
			response.Error(w, http.StatusInternalServerError, "internal_error", "could not register")
		}
		return
	}

	response.JSON(w, http.StatusCreated, result, nil)
}

// Login handles POST /api/v1/auth/login.
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid JSON body")
		return
	}

	result, err := h.svc.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		if errors.Is(err, ErrInvalidCredentials) {
			response.Error(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
			return
		}
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not log in")
		return
	}

	response.JSON(w, http.StatusOK, result, nil)
}

// Refresh handles POST /api/v1/auth/refresh.
func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid JSON body")
		return
	}

	result, err := h.svc.Refresh(r.Context(), req.RefreshToken)
	if err != nil {
		if errors.Is(err, ErrInvalidCredentials) {
			response.Error(w, http.StatusUnauthorized, "invalid_token", "invalid or expired refresh token")
			return
		}
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not refresh token")
		return
	}

	response.JSON(w, http.StatusOK, result, nil)
}
