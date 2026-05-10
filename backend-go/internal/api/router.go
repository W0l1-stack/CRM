package api

import (
	"database/sql"

	"github.com/gorilla/mux"
)

func NewRouter(db *sql.DB) *mux.Router {
	router := mux.NewRouter()

	// Contact routes
	contactHandler := NewContactHandler(db)
	router.HandleFunc("/api/contacts", contactHandler.ListContacts).Methods("GET")
	router.HandleFunc("/api/contacts", contactHandler.CreateContact).Methods("POST")
	router.HandleFunc("/api/contacts/{id}", contactHandler.GetContact).Methods("GET")
	router.HandleFunc("/api/contacts/{id}", contactHandler.UpdateContact).Methods("PUT")
	router.HandleFunc("/api/contacts/{id}", contactHandler.DeleteContact).Methods("DELETE")

	// Deal routes
	dealHandler := NewDealHandler(db)
	router.HandleFunc("/api/deals", dealHandler.ListDeals).Methods("GET")
	router.HandleFunc("/api/deals", dealHandler.CreateDeal).Methods("POST")
	router.HandleFunc("/api/deals/{id}", dealHandler.GetDeal).Methods("GET")
	router.HandleFunc("/api/deals/{id}", dealHandler.UpdateDeal).Methods("PUT")

	// Message routes
	messageHandler := NewMessageHandler(db)
	router.HandleFunc("/api/messages", messageHandler.CreateMessage).Methods("POST")
	router.HandleFunc("/api/messages/contact/{contact_id}", messageHandler.ListMessagesForContact).Methods("GET")

	return router
}
