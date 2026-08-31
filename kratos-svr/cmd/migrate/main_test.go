package main

import "testing"

func TestSelectDSN(t *testing.T) {
	tests := []struct {
		name           string
		flagDSN        string
		environmentDSN string
		want           string
	}{
		{name: "flag takes precedence", flagDSN: "flag-dsn", environmentDSN: "env-dsn", want: "flag-dsn"},
		{name: "environment fallback", environmentDSN: "env-dsn", want: "env-dsn"},
		{name: "missing configuration"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := selectDSN(test.flagDSN, test.environmentDSN); got != test.want {
				t.Errorf("selectDSN(%q, %q) = %q; want %q", test.flagDSN, test.environmentDSN, got, test.want)
			}
		})
	}
}
