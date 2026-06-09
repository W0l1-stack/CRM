// Package crypto provides symmetric encryption for credentials stored at rest
// (account integration secrets). It uses AES-256-GCM with a key derived from a
// shared secret (INTEGRATIONS_ENC_KEY, falling back to JWT_SECRET) so the Node
// service can decrypt with the same scheme: key = sha256(secret); output =
// base64(nonce[12] || ciphertext+tag).
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
)

func deriveKey(secret string) []byte {
	sum := sha256.Sum256([]byte(secret))
	return sum[:]
}

// Encrypt returns base64(nonce || ciphertext) for the plaintext.
func Encrypt(plaintext, secret string) (string, error) {
	block, err := aes.NewCipher(deriveKey(secret))
	if err != nil {
		return "", fmt.Errorf("crypto.Encrypt: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("crypto.Encrypt: %w", err)
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("crypto.Encrypt: nonce: %w", err)
	}
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt reverses Encrypt.
func Decrypt(encoded, secret string) (string, error) {
	raw, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", fmt.Errorf("crypto.Decrypt: base64: %w", err)
	}
	block, err := aes.NewCipher(deriveKey(secret))
	if err != nil {
		return "", fmt.Errorf("crypto.Decrypt: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("crypto.Decrypt: %w", err)
	}
	if len(raw) < gcm.NonceSize() {
		return "", errors.New("crypto.Decrypt: ciphertext too short")
	}
	nonce, ciphertext := raw[:gcm.NonceSize()], raw[gcm.NonceSize():]
	plain, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("crypto.Decrypt: %w", err)
	}
	return string(plain), nil
}
