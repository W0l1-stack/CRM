package billing

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	"crm-go-api/internal/api/response"
	"crm-go-api/internal/middleware"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// Status returns the account's plan, trial info, and whether a subscription exists.
func (h *Handler) Status(w http.ResponseWriter, r *http.Request) {
	accountID, ok := middleware.AccountID(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
		return
	}
	acc, err := h.svc.GetAccount(r.Context(), accountID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not load billing status")
		return
	}
	trialDaysLeft := 0
	if acc.TrialEndsAt != nil {
		if d := int(time.Until(*acc.TrialEndsAt).Hours() / 24); d > 0 {
			trialDaysLeft = d
		}
	}
	response.JSON(w, http.StatusOK, map[string]interface{}{
		"plan":             acc.Plan,
		"trial_ends_at":    acc.TrialEndsAt,
		"trial_days_left":  trialDaysLeft,
		"has_subscription": acc.StripeSubscriptionID != nil && *acc.StripeSubscriptionID != "",
	}, nil)
}

type checkoutRequest struct {
	Plan string `json:"plan"`
}

func (h *Handler) Checkout(w http.ResponseWriter, r *http.Request) {
	accountID, ok := middleware.AccountID(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
		return
	}
	var req checkoutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid JSON body")
		return
	}
	url, err := h.svc.Checkout(r.Context(), accountID, req.Plan)
	if errors.Is(err, ErrValidation) {
		response.Error(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}
	if errors.Is(err, ErrNotConfigured) {
		response.Error(w, http.StatusServiceUnavailable, "not_configured", "billing is not configured")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not start checkout")
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"url": url}, nil)
}

func (h *Handler) Portal(w http.ResponseWriter, r *http.Request) {
	accountID, ok := middleware.AccountID(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
		return
	}
	url, err := h.svc.Portal(r.Context(), accountID)
	if errors.Is(err, ErrNoCustomer) {
		response.Error(w, http.StatusBadRequest, "no_customer", "no active subscription to manage")
		return
	}
	if errors.Is(err, ErrNotConfigured) {
		response.Error(w, http.StatusServiceUnavailable, "not_configured", "billing is not configured")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not open billing portal")
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"url": url}, nil)
}

// Webhook is the public Stripe webhook endpoint (signature-verified, no JWT).
func (h *Handler) Webhook(w http.ResponseWriter, r *http.Request) {
	payload, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "could not read body")
		return
	}
	if err := h.svc.HandleWebhook(r.Context(), payload, r.Header.Get("Stripe-Signature")); err != nil {
		response.Error(w, http.StatusBadRequest, "webhook_error", "could not process webhook")
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"received": "true"}, nil)
}
