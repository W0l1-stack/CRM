package token

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Claims is the JWT payload carried in every access token. account_id is the
// tenant boundary — middleware pulls it out and every query filters by it.
type Claims struct {
	AccountID uuid.UUID `json:"account_id"`
	UserID    uuid.UUID `json:"user_id"`
	Role      string    `json:"role"`
	jwt.RegisteredClaims
}

// IssueAccessToken signs a short-lived access token for the given identity.
func IssueAccessToken(secret string, accountID, userID uuid.UUID, role string, ttl time.Duration) (string, error) {
	now := time.Now()
	claims := Claims{
		AccountID: accountID,
		UserID:    userID,
		Role:      role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		},
	}

	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	if err != nil {
		return "", fmt.Errorf("token.IssueAccessToken: %w", err)
	}
	return signed, nil
}

// ParseAccessToken verifies the signature and expiry and returns the claims.
func ParseAccessToken(secret, tokenStr string) (*Claims, error) {
	claims := &Claims{}
	parsed, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, fmt.Errorf("token.ParseAccessToken: %w", err)
	}
	if !parsed.Valid {
		return nil, fmt.Errorf("token.ParseAccessToken: invalid token")
	}
	return claims, nil
}

// GenerateRefreshToken returns a random opaque token and its SHA-256 hash.
// Only the hash is stored in the database; the raw token goes to the client.
func GenerateRefreshToken() (raw string, hash string, err error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", fmt.Errorf("token.GenerateRefreshToken: %w", err)
	}
	raw = hex.EncodeToString(b)
	return raw, HashRefreshToken(raw), nil
}

// HashRefreshToken hashes a raw refresh token for storage/lookup.
func HashRefreshToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}
