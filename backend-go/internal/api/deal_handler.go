package api

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

type Deal struct {
	ID          string  `json:"id"`
	UserID      string  `json:"user_id"`
	ContactID   string  `json:"contact_id"`
	Name        string  `json:"name"`
	Value       float64 `json:"value"`
	Stage       string  `json:"stage"`
	Probability int     `json:"probability"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`
}

type DealHandler struct {
	db *sql.DB
}

func NewDealHandler(db *sql.DB) *DealHandler {
	return &DealHandler{db: db}
}

func (h *DealHandler) ListDeals(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	rows, err := h.db.Query(
		"SELECT id, user_id, contact_id, name, value, stage, probability, created_at, updated_at FROM deals WHERE user_id = ? ORDER BY created_at DESC",
		userID,
	)
	if err != nil {
		http.Error(w, "query failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	deals := []Deal{}
	for rows.Next() {
		var d Deal
		if err := rows.Scan(&d.ID, &d.UserID, &d.ContactID, &d.Name, &d.Value, &d.Stage, &d.Probability, &d.CreatedAt, &d.UpdatedAt); err != nil {
			http.Error(w, "scan failed", http.StatusInternalServerError)
			return
		}
		deals = append(deals, d)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(deals)
}

func (h *DealHandler) CreateDeal(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var deal Deal
	if err := json.NewDecoder(r.Body).Decode(&deal); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	deal.ID = uuid.New().String()
	deal.UserID = userID

	_, err := h.db.Exec(
		"INSERT INTO deals (id, user_id, contact_id, name, value, stage, probability) VALUES (?, ?, ?, ?, ?, ?, ?)",
		deal.ID, deal.UserID, deal.ContactID, deal.Name, deal.Value, deal.Stage, deal.Probability,
	)
	if err != nil {
		http.Error(w, "insert failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(deal)
}

func (h *DealHandler) GetDeal(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	userID := r.Header.Get("X-User-ID")

	var deal Deal
	err := h.db.QueryRow(
		"SELECT id, user_id, contact_id, name, value, stage, probability, created_at, updated_at FROM deals WHERE id = ? AND user_id = ?",
		id, userID,
	).Scan(&deal.ID, &deal.UserID, &deal.ContactID, &deal.Name, &deal.Value, &deal.Stage, &deal.Probability, &deal.CreatedAt, &deal.UpdatedAt)

	if err == sql.ErrNoRows {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "query failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(deal)
}

func (h *DealHandler) UpdateDeal(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	userID := r.Header.Get("X-User-ID")

	var deal Deal
	if err := json.NewDecoder(r.Body).Decode(&deal); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	_, err := h.db.Exec(
		"UPDATE deals SET name = ?, value = ?, stage = ?, probability = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
		deal.Name, deal.Value, deal.Stage, deal.Probability, id, userID,
	)
	if err != nil {
		http.Error(w, "update failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "updated"})
}
