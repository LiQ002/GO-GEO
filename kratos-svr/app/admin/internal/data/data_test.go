package data

import "testing"

func TestJSONBytes(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		value string
		want  string
		nil   bool
	}{
		{name: "empty", nil: true},
		{name: "whitespace", value: "  ", nil: true},
		{name: "object", value: `{"enabled":true}`, want: `{"enabled":true}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := jsonBytes(tt.value)
			if tt.nil {
				if got != nil {
					t.Fatalf("jsonBytes(%q) = %q; want nil", tt.value, got)
				}
				return
			}
			if string(got) != tt.want {
				t.Fatalf("jsonBytes(%q) = %q; want %q", tt.value, got, tt.want)
			}
		})
	}
}
