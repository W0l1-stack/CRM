package models

import (
	"time"

	"github.com/google/uuid"
)

// Role constants for users within an account.
const (
	RoleOwner  = "owner"
	RoleAdmin  = "admin"
	RoleMember = "member"
)

// User is a person who logs into Lydia. Every user belongs to one account.
type User struct {
	ID           uuid.UUID `json:"id"`
	AccountID    uuid.UUID `json:"account_id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Name         string    `json:"name"`
	Role         string    `json:"role"`
	AvatarURL    *string   `json:"avatar_url"`
	Timezone     string    `json:"timezone"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
