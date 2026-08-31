// Package security provides password hashing helpers without exposing hashes to transports.
package security

import (
	"errors"
	"unicode"

	"golang.org/x/crypto/bcrypt"
)

const minimumPasswordLength = 10

// ValidatePassword enforces the baseline password policy.
func ValidatePassword(password string) error {
	if len([]rune(password)) < minimumPasswordLength {
		return errors.New("password must contain at least 10 characters")
	}
	var hasLetter, hasDigit bool
	for _, character := range password {
		hasLetter = hasLetter || unicode.IsLetter(character)
		hasDigit = hasDigit || unicode.IsDigit(character)
	}
	if !hasLetter || !hasDigit {
		return errors.New("password must contain letters and digits")
	}
	return nil
}

// HashPassword hashes a validated password using bcrypt.
func HashPassword(password string) (string, error) {
	if err := ValidatePassword(password); err != nil {
		return "", err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

// ComparePassword performs a constant-time bcrypt comparison.
func ComparePassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}
