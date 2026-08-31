// Package query contains transport-independent list pagination rules.
package query

import (
	"encoding/base64"
	"errors"
	"strconv"
)

const (
	DefaultPageSize = 20
	MaxPageSize     = 100
)

// Page describes a bounded offset page.
type Page struct {
	Offset int
	Limit  int
}

// ParsePage normalizes a page size and opaque offset token.
func ParsePage(pageSize int32, pageToken string) (Page, error) {
	limit := int(pageSize)
	if limit <= 0 {
		limit = DefaultPageSize
	}
	if limit > MaxPageSize {
		limit = MaxPageSize
	}
	if pageToken == "" {
		return Page{Limit: limit}, nil
	}
	decoded, err := base64.RawURLEncoding.DecodeString(pageToken)
	if err != nil {
		return Page{}, errors.New("invalid page token")
	}
	offset, err := strconv.Atoi(string(decoded))
	if err != nil || offset < 0 {
		return Page{}, errors.New("invalid page token")
	}
	return Page{Offset: offset, Limit: limit}, nil
}

// NextToken returns an opaque token for the next offset.
func NextToken(offset int) string {
	return base64.RawURLEncoding.EncodeToString([]byte(strconv.Itoa(offset)))
}
