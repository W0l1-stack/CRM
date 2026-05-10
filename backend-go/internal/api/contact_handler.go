package api

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

type Contact struct {
	ID        string   `json:"id"`
	UserID    string   `json:"user_id"`
	Email     string   `json:"email"`
	Phone     string   `json:"phone"`
	Name      string   `json:"name"`
	Company   string   `json:"company"`
	Notes     string   `json:"notes"`
	Tags      []string `json:"tags"`
	CreatedAt string   `json:"created_at"`
	UpdatedAt string   `json:"updated_at"`
}

type ContactHandler struct {
	db *sql.DB
}

func NewContactHandler(db *sql.DB) *ContactHandler {
	return &ContactHandler{db: db}
}

func (h *ContactHandler) ListContacts(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	rows, err := h.db.Query(
		"SELECT id, user_id, email, phone, name, company, notes, created_at, updated_at FROM contacts WHERE user_id = ? ORDER BY created_at DESC",
		userID,
	)
	if err != nil {
		http.Error(w, "query failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	contacts := []Contact{}
	for rows.Next() {
		var c Contact
		if err := rows.Scan(&c.ID, &c.UserID, &c.Email, &c.Phone, &c.Name, &c.Company, &c.Notes, &c.CreatedAt, &c.UpdatedAt); err != nil {
			http.Error(w, "scan failed", http.StatusInternalServerError)
			return
		}
		contacts = append(contacts, c)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(contacts)
}

func (h *ContactHandler) CreateContact(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var contact Contact
	if err := json.NewDecoder(r.Body).Decode(&contact); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	contact.ID = uuid.New().String()
	contact.UserID = userID

	_, err := h.db.Exec(
		"INSERT INTO contacts (id, user_id, email, phone, name, company, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
		contact.ID, contact.UserID, contact.Email, contact.Phone, contact.Name, contact.Company, contact.Notes,
	)
	if err != nil {
		http.Error(w, "insert failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(contact)
}

func (h *ContactHandler) GetContact(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	userID := r.Header.Get("X-User-ID")

	var contact Contact
	err := h.db.QueryRow(
		"SELECT id, user_id, email, phone, name, company, notes, created_at, updated_at FROM contacts WHERE id = ? AND user_id = ?",
		id, userID,
	).Scan(&contact.ID, &contact.UserID, &contact.Email, &contact.Phone, &contact.Name, &contact.Company, &contact.Notes, &contact.CreatedAt, &contact.UpdatedAt)

	if err == sql.ErrNoRows {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "query failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(contact)
}

func (h *ContactHandler) UpdateContact(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	userID := r.Header.Get("X-User-ID")

	var contact Contact
	if err := json.NewDecoder(r.Body).Decode(&contact); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	_, err := h.db.Exec(
		"UPDATE contacts SET email = ?, phone = ?, name = ?, company = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
		contact.Email, contact.Phone, contact.Name, contact.Company, contact.Notes, id, userID,
	)
	if err != nil {
		http.Error(w, "update failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "updated"})
}

func (h *ContactHandler) DeleteContact(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	userID := r.Header.Get("X-User-ID")

	_, err := h.db.Exec("DELETE FROM contacts WHERE id = ? AND user_id = ?", id, userID)
	if err != nil {
		http.Error(w, "delete failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
}
