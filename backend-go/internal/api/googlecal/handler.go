package googlecal

import (
	"errors"
	"net/http"

	"crm-go-api/internal/api/response"
	"crm-go-api/internal/middleware"
)

type Handler struct {
	svc         *Service
	frontendURL string
}

func NewHandler(svc *Service, frontendURL string) *Handler {
	return &Handler{svc: svc, frontendURL: frontendURL}
}

// AuthURL (protected) returns the Google consent URL for the current account.
func (h *Handler) AuthURL(w http.ResponseWriter, r *http.Request) {
	accountID, ok := middleware.AccountID(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
		return
	}
	url, err := h.svc.AuthURL(accountID)
	if errors.Is(err, ErrNotConfigured) {
		response.Error(w, http.StatusServiceUnavailable, "not_configured", "Google Calendar is not configured on this server")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not build auth url")
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"url": url}, nil)
}

// Callback (public) is Google's OAuth redirect target. It exchanges the code,
// stores tokens, then bounces the browser back to the app's calendar page.
func (h *Handler) Callback(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	if errParam := q.Get("error"); errParam != "" {
		http.Redirect(w, r, h.frontendURL+"/calendar?google=denied", http.StatusFound)
		return
	}
	code := q.Get("code")
	state := q.Get("state")
	if code == "" || state == "" {
		http.Redirect(w, r, h.frontendURL+"/calendar?google=error", http.StatusFound)
		return
	}
	if _, err := h.svc.HandleCallback(r.Context(), code, state); err != nil {
		http.Redirect(w, r, h.frontendURL+"/calendar?google=error", http.StatusFound)
		return
	}
	http.Redirect(w, r, h.frontendURL+"/calendar?google=connected", http.StatusFound)
}

// Status (protected) reports the account's connection state.
func (h *Handler) Status(w http.ResponseWriter, r *http.Request) {
	accountID, ok := middleware.AccountID(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
		return
	}
	status, err := h.svc.Status(r.Context(), accountID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not load status")
		return
	}
	response.JSON(w, http.StatusOK, status, nil)
}

// Disconnect (protected) removes the stored Google tokens.
func (h *Handler) Disconnect(w http.ResponseWriter, r *http.Request) {
	accountID, ok := middleware.AccountID(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
		return
	}
	if err := h.svc.Disconnect(r.Context(), accountID); err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not disconnect")
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"status": "disconnected"}, nil)
}
