package biz

import "testing"

func TestValidateInclusionSite(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name              string
		entryURL          string
		authorizationType int32
		wantErr           bool
	}{
		{name: "valid HTTPS site without JSON configuration", entryURL: "https://example.com/chat", authorizationType: AuthorizationTypeClientLogin},
		{name: "valid HTTP site", entryURL: "http://localhost:8080", authorizationType: AuthorizationTypeClientLogin},
		{name: "login authorization is required", entryURL: "https://example.com", authorizationType: AuthorizationTypeNone, wantErr: true},
		{name: "missing URL scheme", entryURL: "example.com", authorizationType: AuthorizationTypeClientLogin, wantErr: true},
		{name: "unsupported URL scheme", entryURL: "ftp://example.com", authorizationType: AuthorizationTypeClientLogin, wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			site := &InclusionSite{Code: "demo", DriverType: ModelDriverDeepSeek, Name: "Demo", EntryURL: tt.entryURL, AuthorizationType: tt.authorizationType, Status: PublishChannelStatusActive}
			err := validateInclusionSite(site)
			if (err != nil) != tt.wantErr {
				t.Fatalf("validateInclusionSite() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
