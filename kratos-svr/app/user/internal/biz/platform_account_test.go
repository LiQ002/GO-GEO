package biz

import "testing"

func TestValidClientCredential(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		credential string
		want       bool
	}{
		{name: "shared AES ciphertext", credential: "aes:v2:c3ludGhldGlj", want: true},
		{name: "surrounding whitespace", credential: "  aes:v2:c3ludGhldGlj  ", want: true},
		{name: "empty payload", credential: "aes:v2:"},
		{name: "legacy safe storage ciphertext", credential: "safe:v1:c3ludGhldGlj"},
		{name: "legacy AES ciphertext", credential: "v1:c3ludGhldGlj"},
		{name: "plaintext", credential: "session-cookie"},
		{name: "empty"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := validClientCredential(tt.credential); got != tt.want {
				t.Errorf("validClientCredential(%q) = %v; want %v", tt.credential, got, tt.want)
			}
		})
	}
}
