package middleware

import (
	"context"

	"github.com/google/uuid"
)

type contextKey string

const (
	accountIDKey contextKey = "account_id"
	userIDKey    contextKey = "user_id"
	roleKey      contextKey = "role"
)

// withIdentity stores the authenticated identity on the request context.
func withIdentity(ctx context.Context, accountID, userID uuid.UUID, role string) context.Context {
	ctx = context.WithValue(ctx, accountIDKey, accountID)
	ctx = context.WithValue(ctx, userIDKey, userID)
	ctx = context.WithValue(ctx, roleKey, role)
	return ctx
}

// AccountID returns the tenant account id from the request context. The bool is
// false when the request was not authenticated.
func AccountID(ctx context.Context) (uuid.UUID, bool) {
	v, ok := ctx.Value(accountIDKey).(uuid.UUID)
	return v, ok
}

// UserID returns the authenticated user id from the request context.
func UserID(ctx context.Context) (uuid.UUID, bool) {
	v, ok := ctx.Value(userIDKey).(uuid.UUID)
	return v, ok
}

// Role returns the authenticated user's role from the request context.
func Role(ctx context.Context) (string, bool) {
	v, ok := ctx.Value(roleKey).(string)
	return v, ok
}
