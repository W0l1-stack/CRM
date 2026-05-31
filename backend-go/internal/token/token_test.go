package token

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestIssueAndParseAccessToken(t *testing.T) {
	secret := "test-secret"
	accountID := uuid.New()
	userID := uuid.New()

	tok, err := IssueAccessToken(secret, accountID, userID, "owner", time.Minute)
	if err != nil {
		t.Fatalf("IssueAccessToken: %v", err)
	}

	claims, err := ParseAccessToken(secret, tok)
	if err != nil {
		t.Fatalf("ParseAccessToken: %v", err)
	}
	if claims.AccountID != accountID {
		t.Errorf("account_id = %s, want %s", claims.AccountID, accountID)
	}
	if claims.UserID != userID {
		t.Errorf("user_id = %s, want %s", claims.UserID, userID)
	}
	if claims.Role != "owner" {
		t.Errorf("role = %s, want owner", claims.Role)
	}
}

func TestParseRejectsWrongSecret(t *testing.T) {
	tok, err := IssueAccessToken("right-secret", uuid.New(), uuid.New(), "member", time.Minute)
	if err != nil {
		t.Fatalf("IssueAccessToken: %v", err)
	}
	if _, err := ParseAccessToken("wrong-secret", tok); err == nil {
		t.Error("expected error parsing token with wrong secret, got nil")
	}
}

func TestParseRejectsExpiredToken(t *testing.T) {
	tok, err := IssueAccessToken("secret", uuid.New(), uuid.New(), "member", -time.Minute)
	if err != nil {
		t.Fatalf("IssueAccessToken: %v", err)
	}
	if _, err := ParseAccessToken("secret", tok); err == nil {
		t.Error("expected error parsing expired token, got nil")
	}
}

func TestGenerateRefreshTokenHashIsDeterministic(t *testing.T) {
	raw, hash, err := GenerateRefreshToken()
	if err != nil {
		t.Fatalf("GenerateRefreshToken: %v", err)
	}
	if raw == "" || hash == "" {
		t.Fatal("expected non-empty token and hash")
	}
	if raw == hash {
		t.Error("raw token must not equal its hash")
	}
	if HashRefreshToken(raw) != hash {
		t.Error("HashRefreshToken should reproduce the same hash for the same input")
	}
}
