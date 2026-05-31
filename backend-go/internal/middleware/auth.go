package middleware

import (
	"net/http"
	"strings"

	"crm-go-api/internal/api/response"
	"crm-go-api/internal/token"
)

// Auth returns middleware that requires a valid Bearer access token. It parses
// the JWT, then attaches account_id, user_id and role to the request context so
// downstream handlers and repositories can scope every query by tenant.
func Auth(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if header == "" || !strings.HasPrefix(header, "Bearer ") {
				response.Error(w, http.StatusUnauthorized, "unauthorized", "missing bearer token")
				return
			}

			raw := strings.TrimPrefix(header, "Bearer ")
			claims, err := token.ParseAccessToken(secret, raw)
			if err != nil {
				response.Error(w, http.StatusUnauthorized, "unauthorized", "invalid or expired token")
				return
			}

			ctx := withIdentity(r.Context(), claims.AccountID, claims.UserID, claims.Role)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
