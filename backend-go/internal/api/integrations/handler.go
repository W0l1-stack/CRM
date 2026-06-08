package integrations

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/gorilla/mux"

	"crm-go-api/internal/api/googlecal"
	"crm-go-api/internal/api/response"
	"crm-go-api/internal/config"
	"crm-go-api/internal/middleware"
)

// Handler reports integration status and manages per-account provider
// connections (bring-your-own Twilio/Vonage/Resend/etc.).
type Handler struct {
	cfg    *config.Config
	google *googlecal.Service
	svc    *Service
}

func NewHandler(cfg *config.Config, google *googlecal.Service, svc *Service) *Handler {
	return &Handler{cfg: cfg, google: google, svc: svc}
}

// Status (protected) returns the effective state of each integration: the
// account's own provider when connected, otherwise the server-managed fallback.
func (h *Handler) Status(w http.ResponseWriter, r *http.Request) {
	accountID, ok := middleware.AccountID(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
		return
	}

	byKind := map[string]map[string]interface{}{}
	if list, err := h.svc.List(r.Context(), accountID); err == nil {
		for _, it := range list {
			byKind[it.Kind] = map[string]interface{}{"connected": true, "provider": it.Provider, "from": it.From, "source": "account"}
		}
	}

	email := byKind["email"]
	if email == nil {
		email = map[string]interface{}{"connected": h.cfg.ResendAPIKey != "", "provider": "resend", "source": "server"}
	}
	sms := byKind["sms"]
	if sms == nil {
		smsOK := h.cfg.TwilioAccountSID != "" && h.cfg.TwilioAuthToken != "" && h.cfg.TwilioFromNumber != ""
		sms = map[string]interface{}{"connected": smsOK, "provider": "twilio", "from": h.cfg.TwilioFromNumber, "source": "server"}
	}

	google, err := h.google.Status(r.Context(), accountID)
	if err != nil {
		google = map[string]interface{}{"connected": false, "configured": false}
	}

	response.JSON(w, http.StatusOK, map[string]interface{}{
		"email":  email,
		"sms":    sms,
		"google": google,
	}, nil)
}

// Catalog (protected) lists supported providers + their required fields so the
// UI can render the Connect form.
func (h *Handler) Catalog(w http.ResponseWriter, r *http.Request) {
	response.JSON(w, http.StatusOK, h.svc.Catalog(), nil)
}

// Connections (protected) lists the account's connected providers (no secrets).
func (h *Handler) Connections(w http.ResponseWriter, r *http.Request) {
	accountID, ok := middleware.AccountID(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
		return
	}
	list, err := h.svc.List(r.Context(), accountID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not list connections")
		return
	}
	response.JSON(w, http.StatusOK, list, nil)
}

type connectRequest struct {
	Kind     string            `json:"kind"`
	Provider string            `json:"provider"`
	From     string            `json:"from"`
	Config   map[string]string `json:"config"`
}

// Connect (protected) stores the account's provider credentials.
func (h *Handler) Connect(w http.ResponseWriter, r *http.Request) {
	accountID, ok := middleware.AccountID(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
		return
	}
	var req connectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid JSON body")
		return
	}
	if err := h.svc.Connect(r.Context(), accountID, req.Kind, req.Provider, req.From, req.Config); errors.Is(err, ErrValidation) {
		response.Error(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	} else if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not connect")
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"status": "connected"}, nil)
}

// Disconnect (protected) removes the account's provider for a kind.
func (h *Handler) Disconnect(w http.ResponseWriter, r *http.Request) {
	accountID, ok := middleware.AccountID(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
		return
	}
	kind := mux.Vars(r)["kind"]
	if err := h.svc.Disconnect(r.Context(), accountID, kind); errors.Is(err, ErrValidation) {
		response.Error(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	} else if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "not_found", "not connected")
		return
	} else if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not disconnect")
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"status": "disconnected"}, nil)
}
