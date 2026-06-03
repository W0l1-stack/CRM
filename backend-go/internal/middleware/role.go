package middleware

import (
	"net/http"

	"crm-go-api/internal/api/response"
	"crm-go-api/internal/models"
)

// roleAllowed reports whether the context role is in the allowed set.
func roleAllowed(r *http.Request, allowed map[string]bool) bool {
	role, ok := Role(r.Context())
	return ok && allowed[role]
}

// RequireRoleFunc wraps a single handler so only the listed roles may call it.
// Use this for individual routes (e.g. DELETE) rather than a whole subrouter.
//
//	protected.HandleFunc("/contacts/{id}",
//	    middleware.RequireRoleFunc(h.Delete, models.RoleOwner, models.RoleAdmin)).
//	    Methods(http.MethodDelete)
func RequireRoleFunc(next http.HandlerFunc, roles ...string) http.HandlerFunc {
	allowed := make(map[string]bool, len(roles))
	for _, r := range roles {
		allowed[r] = true
	}
	return func(w http.ResponseWriter, r *http.Request) {
		if !roleAllowed(r, allowed) {
			response.Error(w, http.StatusForbidden, "forbidden", "your role cannot perform this action")
			return
		}
		next(w, r)
	}
}

// RequireManager allows only owners and admins (members are blocked).
func RequireManager(next http.HandlerFunc) http.HandlerFunc {
	return RequireRoleFunc(next, models.RoleOwner, models.RoleAdmin)
}

// RequireOwner allows only the account owner (e.g. billing).
func RequireOwner(next http.HandlerFunc) http.HandlerFunc {
	return RequireRoleFunc(next, models.RoleOwner)
}
