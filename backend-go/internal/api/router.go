package api

import (
	"context"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/jackc/pgx/v5/pgxpool"

	"crm-go-api/internal/api/appointments"
	"crm-go-api/internal/api/auth"
	"crm-go-api/internal/api/automations"
	"crm-go-api/internal/api/billing"
	"crm-go-api/internal/api/campaigns"
	"crm-go-api/internal/api/contacts"
	"crm-go-api/internal/api/conversations"
	"crm-go-api/internal/api/deals"
	"crm-go-api/internal/api/forms"
	"crm-go-api/internal/api/googlecal"
	"crm-go-api/internal/api/integrations"
	"crm-go-api/internal/api/pipelines"
	"crm-go-api/internal/api/subaccounts"
	"crm-go-api/internal/api/team"
	"crm-go-api/internal/config"
	"crm-go-api/internal/events"
	"crm-go-api/internal/middleware"
	"crm-go-api/internal/plan"
	"crm-go-api/internal/ratelimit"
)

// clientIP extracts the caller's IP for rate-limit keys (first X-Forwarded-For
// hop when present, else the remote address).
func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if i := strings.IndexByte(xff, ','); i >= 0 {
			return strings.TrimSpace(xff[:i])
		}
		return strings.TrimSpace(xff)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// NewRouter wires every dependency and returns the configured router.
// Public auth routes live under /api/v1/auth; everything else under /api/v1 is
// behind the Auth + RequireTenant middleware so every request carries account_id.
func NewRouter(pool *pgxpool.Pool, cfg *config.Config, publisher *events.Publisher) *mux.Router {
	router := mux.NewRouter()

	// CORS is applied by wrapping the router in main (so it also covers
	// preflight OPTIONS requests that match no registered method).
	router.Use(middleware.Logger)

	limiter := ratelimit.New(cfg.RedisURL)
	byIP := func(r *http.Request) string { return clientIP(r) }
	byAccount := func(r *http.Request) string {
		if id, ok := middleware.AccountID(r.Context()); ok {
			return id.String()
		}
		return clientIP(r)
	}

	router.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":{"status":"ok"},"error":null,"meta":null}`))
	}).Methods(http.MethodGet)

	// ---- Public auth routes ----
	authService := auth.NewService(auth.NewRepository(pool), cfg.JWTSecret, cfg.AccessTokenTTL, cfg.RefreshTokenTTL)
	authHandler := auth.NewHandler(authService)
	public := router.PathPrefix("/api/v1/auth").Subrouter()
	public.Use(limiter.Middleware(30, time.Minute, byIP)) // throttle auth abuse per IP
	public.HandleFunc("/register", authHandler.Register).Methods(http.MethodPost)
	public.HandleFunc("/login", authHandler.Login).Methods(http.MethodPost)
	public.HandleFunc("/refresh", authHandler.Refresh).Methods(http.MethodPost)

	// ---- Google Calendar integration ----
	googleSvc := googlecal.NewService(googlecal.NewRepository(pool), cfg)
	googleHandler := googlecal.NewHandler(googleSvc, cfg.FrontendURL)

	// ---- Public booking routes (no auth; identified by appointment type id) ----
	apptHandler := appointments.NewHandler(appointments.NewService(appointments.NewRepository(pool), publisher, googleSvc))
	booking := router.PathPrefix("/api/v1/public/appointment-types").Subrouter()
	booking.HandleFunc("/{id}", apptHandler.PublicGetType).Methods(http.MethodGet)
	booking.HandleFunc("/{id}/slots", apptHandler.PublicSlots).Methods(http.MethodGet)
	booking.HandleFunc("/{id}/book", apptHandler.PublicBook).Methods(http.MethodPost)

	formHandler := forms.NewHandler(forms.NewService(forms.NewRepository(pool), publisher))
	publicForms := router.PathPrefix("/api/v1/public/forms").Subrouter()
	publicForms.HandleFunc("/{id}", formHandler.PublicGet).Methods(http.MethodGet)
	publicForms.HandleFunc("/{id}/submit", formHandler.PublicSubmit).Methods(http.MethodPost)

	campaignHandler := campaigns.NewHandler(campaigns.NewService(campaigns.NewRepository(pool), publisher))
	router.HandleFunc("/api/v1/public/unsubscribe", campaignHandler.Unsubscribe).Methods(http.MethodGet)

	// Google OAuth callback is public (browser redirect from Google; the signed
	// state carries the account id).
	router.HandleFunc("/api/v1/integrations/google/callback", googleHandler.Callback).Methods(http.MethodGet)

	// ---- Billing (Stripe) ----
	billingRepo := billing.NewRepository(pool)
	billingHandler := billing.NewHandler(billing.NewService(
		billingRepo, cfg.StripeSecretKey, cfg.StripeWebhookKey, cfg.StripePriceStarter, cfg.StripePricePro, cfg.FrontendURL,
	))
	// Stripe webhook is public (verified by signature, not JWT).
	router.HandleFunc("/api/v1/webhooks/stripe", billingHandler.Webhook).Methods(http.MethodPost)

	// ---- Protected routes ----
	protected := router.PathPrefix("/api/v1").Subrouter()
	protected.Use(middleware.Auth(cfg.JWTSecret))
	protected.Use(middleware.RequireTenant)
	protected.Use(limiter.Middleware(600, time.Minute, byAccount)) // per-account API budget
	// Block mutating requests once a trial has expired (billing routes exempt).
	protected.Use(middleware.TrialGuard(func(ctx context.Context, accountID uuid.UUID) (string, *time.Time, error) {
		acc, err := billingRepo.GetAccount(ctx, accountID)
		if err != nil {
			return "", nil, err
		}
		return acc.Plan, acc.TrialEndsAt, nil
	}))

	enforcer := plan.NewEnforcer(pool)

	contactHandler := contacts.NewHandler(contacts.NewService(contacts.NewRepository(pool), publisher, enforcer))
	protected.HandleFunc("/contacts", contactHandler.List).Methods(http.MethodGet)
	protected.HandleFunc("/contacts", contactHandler.Create).Methods(http.MethodPost)
	protected.HandleFunc("/contacts/import", contactHandler.Import).Methods(http.MethodPost)
	protected.HandleFunc("/contacts/{id}", contactHandler.Get).Methods(http.MethodGet)
	protected.HandleFunc("/contacts/{id}/timeline", contactHandler.Timeline).Methods(http.MethodGet)
	protected.HandleFunc("/contacts/{id}", contactHandler.Update).Methods(http.MethodPut)
	// Deletes are restricted to managers (owner/admin); members cannot delete.
	protected.HandleFunc("/contacts/{id}", middleware.RequireManager(contactHandler.Delete)).Methods(http.MethodDelete)

	pipelineHandler := pipelines.NewHandler(pipelines.NewService(pipelines.NewRepository(pool), enforcer))
	protected.HandleFunc("/pipelines", pipelineHandler.List).Methods(http.MethodGet)
	protected.HandleFunc("/pipelines", pipelineHandler.Create).Methods(http.MethodPost)
	protected.HandleFunc("/pipelines/{id}", pipelineHandler.Get).Methods(http.MethodGet)
	protected.HandleFunc("/pipelines/{id}", pipelineHandler.Update).Methods(http.MethodPut)
	protected.HandleFunc("/pipelines/{id}", middleware.RequireManager(pipelineHandler.Delete)).Methods(http.MethodDelete)

	dealHandler := deals.NewHandler(deals.NewService(deals.NewRepository(pool), publisher))
	protected.HandleFunc("/deals", dealHandler.List).Methods(http.MethodGet)
	protected.HandleFunc("/deals", dealHandler.Create).Methods(http.MethodPost)
	protected.HandleFunc("/deals/{id}", dealHandler.Get).Methods(http.MethodGet)
	protected.HandleFunc("/deals/{id}", dealHandler.Update).Methods(http.MethodPut)
	protected.HandleFunc("/deals/{id}", middleware.RequireManager(dealHandler.Delete)).Methods(http.MethodDelete)

	automationHandler := automations.NewHandler(automations.NewService(automations.NewRepository(pool), enforcer))
	protected.HandleFunc("/automations", automationHandler.List).Methods(http.MethodGet)
	protected.HandleFunc("/automations", automationHandler.Create).Methods(http.MethodPost)
	protected.HandleFunc("/automations/{id}", automationHandler.Get).Methods(http.MethodGet)
	protected.HandleFunc("/automations/{id}", automationHandler.Update).Methods(http.MethodPut)
	protected.HandleFunc("/automations/{id}", middleware.RequireManager(automationHandler.Delete)).Methods(http.MethodDelete)

	integrationsHandler := integrations.NewHandler(cfg, googleSvc, integrations.NewService(integrations.NewRepository(pool, cfg.JWTSecret)))
	protected.HandleFunc("/integrations/status", integrationsHandler.Status).Methods(http.MethodGet)
	protected.HandleFunc("/integrations/catalog", integrationsHandler.Catalog).Methods(http.MethodGet)
	protected.HandleFunc("/integrations/connections", integrationsHandler.Connections).Methods(http.MethodGet)
	// Connecting/disconnecting a provider is an owner/admin action.
	protected.HandleFunc("/integrations/connections", middleware.RequireManager(integrationsHandler.Connect)).Methods(http.MethodPost)
	protected.HandleFunc("/integrations/connections/{kind}", middleware.RequireManager(integrationsHandler.Disconnect)).Methods(http.MethodDelete)
	protected.HandleFunc("/integrations/google/auth-url", googleHandler.AuthURL).Methods(http.MethodGet)
	protected.HandleFunc("/integrations/google/status", googleHandler.Status).Methods(http.MethodGet)
	protected.HandleFunc("/integrations/google", googleHandler.Disconnect).Methods(http.MethodDelete)

	protected.HandleFunc("/appointment-types", apptHandler.ListTypes).Methods(http.MethodGet)
	protected.HandleFunc("/appointment-types", apptHandler.CreateType).Methods(http.MethodPost)
	protected.HandleFunc("/appointment-types/{id}", apptHandler.DeleteType).Methods(http.MethodDelete)
	protected.HandleFunc("/appointments", apptHandler.ListAppointments).Methods(http.MethodGet)
	protected.HandleFunc("/appointments/{id}/status", apptHandler.UpdateStatus).Methods(http.MethodPut)

	protected.HandleFunc("/billing", billingHandler.Status).Methods(http.MethodGet)
	// Only the account owner can change the subscription.
	protected.HandleFunc("/billing/checkout", middleware.RequireOwner(billingHandler.Checkout)).Methods(http.MethodPost)
	protected.HandleFunc("/billing/portal", middleware.RequireOwner(billingHandler.Portal)).Methods(http.MethodPost)

	// ---- Sub-accounts (agency model) ----
	subHandler := subaccounts.NewHandler(subaccounts.NewService(subaccounts.NewRepository(pool), authService))
	protected.HandleFunc("/sub-accounts", middleware.RequireManager(subHandler.List)).Methods(http.MethodGet)
	protected.HandleFunc("/sub-accounts", middleware.RequireOwner(subHandler.Create)).Methods(http.MethodPost)
	protected.HandleFunc("/sub-accounts/{id}/switch", middleware.RequireOwner(subHandler.Switch)).Methods(http.MethodPost)

	teamHandler := team.NewHandler(team.NewService(team.NewRepository(pool), enforcer))
	protected.HandleFunc("/me", teamHandler.Me).Methods(http.MethodGet)
	protected.HandleFunc("/me", teamHandler.UpdateMe).Methods(http.MethodPut)
	protected.HandleFunc("/account", teamHandler.GetAccount).Methods(http.MethodGet)
	protected.HandleFunc("/account", teamHandler.UpdateAccount).Methods(http.MethodPut)
	protected.HandleFunc("/team", teamHandler.ListMembers).Methods(http.MethodGet)
	protected.HandleFunc("/team", teamHandler.Invite).Methods(http.MethodPost)
	protected.HandleFunc("/team/{id}/role", teamHandler.ChangeRole).Methods(http.MethodPut)
	protected.HandleFunc("/team/{id}", teamHandler.Remove).Methods(http.MethodDelete)

	protected.HandleFunc("/forms", formHandler.List).Methods(http.MethodGet)
	protected.HandleFunc("/forms", formHandler.Create).Methods(http.MethodPost)
	protected.HandleFunc("/forms/{id}", formHandler.Get).Methods(http.MethodGet)
	protected.HandleFunc("/forms/{id}", formHandler.Update).Methods(http.MethodPut)
	protected.HandleFunc("/forms/{id}", middleware.RequireManager(formHandler.Delete)).Methods(http.MethodDelete)

	protected.HandleFunc("/campaigns", campaignHandler.List).Methods(http.MethodGet)
	protected.HandleFunc("/campaigns", campaignHandler.Create).Methods(http.MethodPost)
	protected.HandleFunc("/campaigns/{id}", campaignHandler.Get).Methods(http.MethodGet)
	protected.HandleFunc("/campaigns/{id}/recipients", campaignHandler.Recipients).Methods(http.MethodGet)
	protected.HandleFunc("/campaigns/{id}", campaignHandler.Update).Methods(http.MethodPut)
	protected.HandleFunc("/campaigns/{id}", middleware.RequireManager(campaignHandler.Delete)).Methods(http.MethodDelete)
	protected.HandleFunc("/campaigns/{id}/send", campaignHandler.Send).Methods(http.MethodPost)
	protected.HandleFunc("/campaigns/{id}/schedule", campaignHandler.Schedule).Methods(http.MethodPost)

	convHandler := conversations.NewHandler(conversations.NewService(conversations.NewRepository(pool), publisher))
	protected.HandleFunc("/conversations", convHandler.List).Methods(http.MethodGet)
	protected.HandleFunc("/conversations", convHandler.Create).Methods(http.MethodPost)
	protected.HandleFunc("/conversations/{id}", convHandler.Get).Methods(http.MethodGet)
	protected.HandleFunc("/conversations/{id}", middleware.RequireManager(convHandler.Delete)).Methods(http.MethodDelete)
	protected.HandleFunc("/conversations/{id}/status", convHandler.UpdateStatus).Methods(http.MethodPut)
	protected.HandleFunc("/conversations/{id}/messages", convHandler.ListMessages).Methods(http.MethodGet)
	protected.HandleFunc("/conversations/{id}/messages", convHandler.CreateMessage).Methods(http.MethodPost)

	return router
}
