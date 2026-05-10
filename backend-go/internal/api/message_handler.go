package api

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

type Message struct {
	ID        string `json:"id"`
	UserID    string `json:"user_id"`
	ContactID string `json:"contact_id"`
	Type      string `json:"type"`
	Content   string `json:"content"`
	Status    string `json:"status"`
	CreatedAt string `json:"created_at"`
}

type MessageHandler struct {
	db *sql.DB
}

func NewMessageHandler(db *sql.DB) *MessageHandler {
	return &MessageHandler{db: db}
}

func (h *MessageHandler) ListMessagesForContact(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	contactID := mux.Vars(r)["contact_id"]
	rows, err := h.db.Query(
		"SELECT id, user_id, contact_id, type, content, status, created_at FROM messages WHERE user_id = ? AND contact_id = ? ORDER BY created_at ASC",
		userID, contactID,
	)
	if err != nil {
		http.Error(w, "query failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	messages := []Message{}
	for rows.Next() {
		var m Message
		if err := rows.Scan(&m.ID, &m.UserID, &m.ContactID, &m.Type, &m.Content, &m.Status, &m.CreatedAt); err != nil {
			http.Error(w, "scan failed", http.StatusInternalServerError)
			return
		}
		messages = append(messages, m)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}

func (h *MessageHandler) CreateMessage(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var message Message
	if err := json.NewDecoder(r.Body).Decode(&message); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	if message.ContactID == "" || message.Content == "" {
		http.Error(w, "contact_id and content are required", http.StatusBadRequest)
		return
	}
	if message.Type == "" {
		message.Type = "email"
	}
	if message.Status == "" {
		message.Status = "sent"
	}

	message.ID = uuid.New().String()
	message.UserID = userID

	_, err := h.db.Exec(
		"INSERT INTO messages (id, user_id, contact_id, type, content, status) VALUES (?, ?, ?, ?, ?, ?)",
		message.ID, message.UserID, message.ContactID, message.Type, message.Content, message.Status,
	)
	if err != nil {
		http.Error(w, "insert failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(message)
}
