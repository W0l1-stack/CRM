package contacts

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/google/uuid"
	"github.com/gorilla/mux"

	"crm-go-api/internal/api/response"
	"crm-go-api/internal/middleware"
	"crm-go-api/internal/models"
)

// Handler exposes the contact HTTP endpoints. account_id always comes from the
// JWT context — never from the request body or query string.
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

	q := r.URL.Query()
	list, err := h.svc.List(r.Context(), accountID, q.Get("search"), q.Get("tag"))
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not list contacts")
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
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid contact id")
		return
	}

	c, err := h.svc.Get(r.Context(), accountID, id)
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "not_found", "contact not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not load contact")
		return
	}
	response.JSON(w, http.StatusOK, c, nil)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	accountID, ok := middleware.AccountID(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
		return
	}

	var c models.Contact
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid JSON body")
		return
	}

	created, err := h.svc.Create(r.Context(), accountID, &c)
	if errors.Is(err, ErrValidation) {
		response.Error(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}
	if errors.Is(err, ErrLimitReached) {
		response.Error(w, http.StatusPaymentRequired, "plan_limit", err.Error())
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not create contact")
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
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid contact id")
		return
	}

	var c models.Contact
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid JSON body")
		return
	}

	updated, err := h.svc.Update(r.Context(), accountID, id, &c)
	if errors.Is(err, ErrValidation) {
		response.Error(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "not_found", "contact not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not update contact")
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
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid contact id")
		return
	}

	if err := h.svc.Delete(r.Context(), accountID, id); errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "not_found", "contact not found")
		return
	} else if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not delete contact")
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"status": "deleted"}, nil)
}

// Import handles POST /api/v1/contacts/import — a multipart upload with a "file"
// field containing a CSV of contacts.
func (h *Handler) Import(w http.ResponseWriter, r *http.Request) {
	accountID, ok := middleware.AccountID(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
		return
	}

	if err := r.ParseMultipartForm(16 << 20); err != nil { // 16 MB
		response.Error(w, http.StatusBadRequest, "bad_request", "could not parse upload")
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "missing 'file' upload field")
		return
	}
	defer file.Close()

	result, err := h.svc.ImportCSV(r.Context(), accountID, file)
	if errors.Is(err, ErrValidation) {
		response.Error(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not import contacts")
		return
	}
	response.JSON(w, http.StatusOK, result, nil)
}

// Timeline handles GET /api/v1/contacts/{id}/timeline.
func (h *Handler) Timeline(w http.ResponseWriter, r *http.Request) {
	accountID, ok := middleware.AccountID(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
		return
	}
	id, err := uuid.Parse(mux.Vars(r)["id"])
	if err != nil {
		response.Error(w, http.StatusBadRequest, "bad_request", "invalid contact id")
		return
	}
	limit := 0
	if l := r.URL.Query().Get("limit"); l != "" {
		limit, _ = strconv.Atoi(l)
	}

	events, err := h.svc.Timeline(r.Context(), accountID, id, limit)
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "not_found", "contact not found")
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "internal_error", "could not load timeline")
		return
	}
	response.JSON(w, http.StatusOK, events, map[string]interface{}{"count": len(events)})
}
