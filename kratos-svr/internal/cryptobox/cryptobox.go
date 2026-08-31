// Package cryptobox provides authenticated encryption for credential envelopes.
package cryptobox

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
)

const Algorithm = "AES-256-GCM"

// Box seals credentials using a process-configured 256-bit key.
type Box struct{ aead cipher.AEAD }

// New constructs a Box from a base64-encoded 32-byte key.
func New(encodedKey string) (*Box, error) {
	key, err := base64.StdEncoding.DecodeString(encodedKey)
	if err != nil {
		return nil, fmt.Errorf("decode credential encryption key: %w", err)
	}
	if len(key) != 32 {
		return nil, errors.New("credential encryption key must decode to 32 bytes")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("create AES cipher: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create GCM: %w", err)
	}
	return &Box{aead: aead}, nil
}

// Seal returns a random nonce and authenticated ciphertext.
func (b *Box) Seal(plaintext, associatedData []byte) ([]byte, []byte, error) {
	nonce := make([]byte, b.aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, nil, fmt.Errorf("read credential nonce: %w", err)
	}
	ciphertext := b.aead.Seal(nil, nonce, plaintext, associatedData)
	return nonce, ciphertext, nil
}

// Open authenticates and decrypts a credential envelope.
func (b *Box) Open(nonce, ciphertext, associatedData []byte) ([]byte, error) {
	plaintext, err := b.aead.Open(nil, nonce, ciphertext, associatedData)
	if err != nil {
		return nil, errors.New("credential envelope authentication failed")
	}
	return plaintext, nil
}
