package data

import "testing"

func TestNextCustomerAuthorizationState(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name, authorizationStatus, usageStatus, action string
		wantAuthorization, wantUsage                   string
		wantOK                                         bool
	}{
		{name: "pause active account", authorizationStatus: "active", usageStatus: "enabled", action: "pause", wantAuthorization: "active", wantUsage: "paused", wantOK: true},
		{name: "resume paused account", authorizationStatus: "active", usageStatus: "paused", action: "resume", wantAuthorization: "active", wantUsage: "enabled", wantOK: true},
		{name: "revoke active account", authorizationStatus: "active", usageStatus: "enabled", action: "revoke", wantAuthorization: "revoked", wantUsage: "disabled", wantOK: true},
		{name: "cannot resume revoked account", authorizationStatus: "revoked", usageStatus: "disabled", action: "resume", wantAuthorization: "revoked", wantUsage: "disabled"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			authorization, usage, ok := nextCustomerAuthorizationState(tt.authorizationStatus, tt.usageStatus, tt.action)
			if authorization != tt.wantAuthorization || usage != tt.wantUsage || ok != tt.wantOK {
				t.Fatalf("nextCustomerAuthorizationState() = (%q, %q, %v), want (%q, %q, %v)", authorization, usage, ok, tt.wantAuthorization, tt.wantUsage, tt.wantOK)
			}
		})
	}
}
