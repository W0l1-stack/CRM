package api

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/jackc/pgx/v5/pgxpool"

	"crm-go-api/internal/api/appointments"
	"crm-go-api/internal/api/auth"
	"crm-go-api/internal/api/automations"
	"crm-go-api/internal/api/contacts"
	"crm-go-api/internal/api/conversations"
	"crm-go-api/internal/api/deals"
	"crm-go-api/internal/api/pipelines"
	"crm-go-api/internal/config"
	"crm-go-api/internal/events"
	"crm-go-api/internal/middleware"
)

// NewRouter wires every dependency and returns the configured router.
// Public auth routes live under /api/v1/auth; everything else under /api/v1 is
// behind the Auth + RequireTenant middleware so every request carries account_id.
func NewRouter(pool *pgxpool.Pool, cfg *config.Config, publisher *events.Publisher) *mux.Router {
	router := mux.NewRouter()

	router.Use(middleware.CORS)
	router.Use(middleware.Logger)

	router.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":{"status":"ok"},"error":null,"meta":null}`))
	}).Methods(http.MethodGet)

	// ---- Public auth routes ----
	authHandler := auth.NewHandler(
		auth.NewService(auth.NewRepository(pool), cfg.JWTSecret, cfg.AccessTokenTTL, cfg.RefreshTokenTTL),
	)
	public := router.PathPrefix("/api/v1/auth").Subrouter()
	public.HandleFunc("/register", authHandler.Register).Methods(http.MethodPost)
	public.HandleFunc("/login", authHandler.Login).Methods(http.MethodPost)
	public.HandleFunc("/refresh", authHandler.Refresh).Methods(http.MethodPost)

	// ---- Public booking routes (no auth; identified by appointment type id) ----
	apptHandler := appointments.NewHandler(appointments.NewService(appointments.NewRepository(pool), publisher))
	booking := router.PathPrefix("/api/v1/public/appointment-types").Subrouter()
	booking.HandleFunc("/{id}", apptHandler.PublicGetType).Methods(http.MethodGet)
	booking.HandleFunc("/{id}/slots", apptHandler.PublicSlots).Methods(http.MethodGet)
	booking.HandleFunc("/{id}/book", apptHandler.PublicBook).Methods(http.MethodPost)

	// ---- Protected routes ----
	protected := router.PathPrefix("/api/v1").Subrouter()
	protected.Use(middleware.Auth(cfg.JWTSecret))
	protected.Use(middleware.RequireTenant)

	contactHandler := contacts.NewHandler(contacts.NewService(contacts.NewRepository(pool), publisher))
	protected.HandleFunc("/contacts", contactHandler.List).Methods(http.MethodGet)
	protected.HandleFunc("/contacts", contactHandler.Create).Methods(http.MethodPost)
	protected.HandleFunc("/contacts/import", contactHandler.Import).Methods(http.MethodPost)
	protected.HandleFunc("/contacts/{id}", contactHandler.Get).Methods(http.MethodGet)
	protected.HandleFunc("/contacts/{id}/timeline", contactHandler.Timeline).Methods(http.MethodGet)
	protected.HandleFunc("/contacts/{id}", contactHandler.Update).Methods(http.MethodPut)
	protected.HandleFunc("/contacts/{id}", contactHandler.Delete).Methods(http.MethodDelete)

	pipelineHandler := pipelines.NewHandler(pipelines.NewService(pipelines.NewRepository(pool)))
	protected.HandleFunc("/pipelines", pipelineHandler.List).Methods(http.MethodGet)
	protected.HandleFunc("/pipelines", pipelineHandler.Create).Methods(http.MethodPost)
	protected.HandleFunc("/pipelines/{id}", pipelineHandler.Get).Methods(http.MethodGet)

	dealHandler := deals.NewHandler(deals.NewService(deals.NewRepository(pool)))
	protected.HandleFunc("/deals", dealHandler.List).Methods(http.MethodGet)
	protected.HandleFunc("/deals", dealHandler.Create).Methods(http.MethodPost)
	protected.HandleFunc("/deals/{id}", dealHandler.Get).Methods(http.MethodGet)
	protected.HandleFunc("/deals/{id}", dealHandler.Update).Methods(http.MethodPut)
	protected.HandleFunc("/deals/{id}", dealHandler.Delete).Methods(http.MethodDelete)

	automationHandler := automations.NewHandler(automations.NewService(automations.NewRepository(pool)))
	protected.HandleFunc("/automations", automationHandler.List).Methods(http.MethodGet)
	protected.HandleFunc("/automations", automationHandler.Create).Methods(http.MethodPost)
	protected.HandleFunc("/automations/{id}", automationHandler.Get).Methods(http.MethodGet)
	protected.HandleFunc("/automations/{id}", automationHandler.Update).Methods(http.MethodPut)
	protected.HandleFunc("/automations/{id}", automationHandler.Delete).Methods(http.MethodDelete)

	protected.HandleFunc("/appointment-types", apptHandler.ListTypes).Methods(http.MethodGet)
	protected.HandleFunc("/appointment-types", apptHandler.CreateType).Methods(http.MethodPost)
	protected.HandleFunc("/appointment-types/{id}", apptHandler.DeleteType).Methods(http.MethodDelete)
	protected.HandleFunc("/appointments", apptHandler.ListAppointments).Methods(http.MethodGet)
	protected.HandleFunc("/appointments/{id}/status", apptHandler.UpdateStatus).Methods(http.MethodPut)

	convHandler := conversations.NewHandler(conversations.NewService(conversations.NewRepository(pool)))
	protected.HandleFunc("/conversations", convHandler.List).Methods(http.MethodGet)
	protected.HandleFunc("/conversations", convHandler.Create).Methods(http.MethodPost)
	protected.HandleFunc("/conversations/{id}", convHandler.Get).Methods(http.MethodGet)
	protected.HandleFunc("/conversations/{id}/status", convHandler.UpdateStatus).Methods(http.MethodPut)
	protected.HandleFunc("/conversations/{id}/messages", convHandler.ListMessages).Methods(http.MethodGet)
	protected.HandleFunc("/conversations/{id}/messages", convHandler.CreateMessage).Methods(http.MethodPost)

	return router
}
