package service

import (
	"testing"

	"kratos-svr/internal/query"
)

func TestParseUserPage(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		pageSize   int32
		pageToken  string
		wantLimit  int
		wantOffset int
	}{
		{name: "default page size", wantLimit: 10},
		{name: "requested page size", pageSize: 7, wantLimit: 7},
		{name: "opaque page token", pageSize: 10, pageToken: query.NextToken(20), wantLimit: 10, wantOffset: 20},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			page, err := parseUserPage(tt.pageSize, tt.pageToken)
			if err != nil {
				t.Fatalf("parseUserPage() error = %v", err)
			}
			if page.Limit != tt.wantLimit || page.Offset != tt.wantOffset {
				t.Fatalf("parseUserPage() = %#v, want limit %d offset %d", page, tt.wantLimit, tt.wantOffset)
			}
		})
	}
}
