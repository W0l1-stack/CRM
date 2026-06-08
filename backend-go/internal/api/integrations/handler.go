package integrations

import (
	"net/http"

	"crm-go-api/internal/api/googlecal"
	"crm-go-api/internal/api/response"
	"crm-go-api/internal/config"
	"crm-go-api/internal/middleware"
)

// Handler reports the connection state of the platform integrations so the UI
// can show real "Connected / Not connected" status instead of a hardcoded
// badge. Email/SMS are server-managed (configured via env), while Google
// Calendar is per-account (OAuth).
type Handler struct {
	cfg    *config.Config
	google *googlecal.Service
}

func NewHandler(cfg *config.Config, google *googlecal.Service) *Handler {
	return &Handler{cfg: cfg, google: google}
}

// Status (protected) returns the state of each integration for the account.
func (h *Handler) Status(w http.ResponseWriter, r *http.Request) {
	accountID, ok := middleware.AccountID(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
		return
	}

	emailConfigured := h.cfg.ResendAPIKey != ""
	smsConfigured := h.cfg.TwilioAccountSID != "" && h.cfg.TwilioAuthToken != "" && h.cfg.TwilioFromNumber != ""

	google, err := h.google.Status(r.Context(), accountID)
	if err != nil {
		// Don't fail the whole panel if Google lookup errors; report disconnected.
		google = map[string]interface{}{"connected": false, "configured": false}
	}

	out := map[string]interface{}{
		"email": map[string]interface{}{
			"provider":   "Resend",
			"configured": emailConfigured,
		},
		"sms": map[string]interface{}{
			"provider":    "Twilio",
			"configured":  smsConfigured,
			"from_number": h.cfg.TwilioFromNumber,
		},
		"google": google,
	}
	response.JSON(w, http.StatusOK, out, nil)
}
