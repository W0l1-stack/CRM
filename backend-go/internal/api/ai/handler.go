package ai

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/google/uuid"

	"crm-go-api/internal/api/response"
	"crm-go-api/internal/middleware"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

type assistRequest struct {
	Messages []ChatMessage `json:"messages"`
}

// Assist (protected) runs one assistant turn using the account's Anthropic key.
func (h *Handler) Assist(w http.ResponseWriter, r *http.Request) {
	accountID, ok := middleware.AccountID(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
		return
	}
	var userPtr *uuid.UUID
	if uid, ok := middleware.UserID(r.Context()); ok {
		userPtr = &uid
	}

	var req assistRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid JSON body")
		return
	}
	if len(req.Messages) == 0 {
		response.Error(w, http.StatusBadRequest, "bad_request", "messages are required")
		return
	}

	reply, created, err := h.svc.Assist(r.Context(), accountID, userPtr, req.Messages)
	if errors.Is(err, ErrNotConnected) {
		response.Error(w, http.StatusBadRequest, "not_connected", "Connect your Anthropic key in Settings → Integrations first.")
		return
	}
	if err != nil {
		response.Error(w, http.StatusBadGateway, "ai_error", err.Error())
		return
	}
	response.JSON(w, http.StatusOK, map[string]interface{}{"reply": reply, "created": created}, nil)
}
