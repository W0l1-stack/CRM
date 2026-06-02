package middleware

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"crm-go-api/internal/api/response"
)

// TrialLookup returns an account's plan and trial expiry. Supplied by the
// router (closing over the billing repo) so middleware has no app-package import.
type TrialLookup func(ctx context.Context, accountID uuid.UUID) (plan string, trialEndsAt *time.Time, err error)

// TrialGuard blocks mutating requests once a trial account's trial has ended.
// Reads (GET/HEAD) always pass; billing routes pass so the user can upgrade.
func TrialGuard(lookup TrialLookup) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.Method {
			case http.MethodGet, http.MethodHead, http.MethodOptions:
				next.ServeHTTP(w, r)
				return
			}
			if strings.HasPrefix(r.URL.Path, "/api/v1/billing") {
				next.ServeHTTP(w, r)
				return
			}

			accountID, ok := AccountID(r.Context())
			if !ok {
				next.ServeHTTP(w, r) // auth middleware already gates this
				return
			}

			plan, trialEndsAt, err := lookup(r.Context(), accountID)
			if err == nil && plan == "trial" && trialEndsAt != nil && time.Now().After(*trialEndsAt) {
				response.Error(w, http.StatusPaymentRequired, "trial_expired",
					"your free trial has ended — upgrade your plan to continue")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
