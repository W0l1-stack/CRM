package middleware

import (
	"net/http"

	"crm-go-api/internal/api/response"
)

// RequireTenant is defense-in-depth: it rejects any request that reached a
// protected handler without an account_id on the context. Auth always sets it,
// so this only fires if a route was mis-wired without the Auth middleware.
func RequireTenant(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := AccountID(r.Context()); !ok {
			response.Error(w, http.StatusUnauthorized, "unauthorized", "no tenant context")
			return
		}
		next.ServeHTTP(w, r)
	})
}
