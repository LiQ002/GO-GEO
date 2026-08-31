package biz

import (
	"testing"
	"time"
)

func TestNormalizeReportRangeDefaultsToThirtyDays(t *testing.T) {
	filter, err := normalizeReportRange(1, MetricsFilter{})
	if err != nil {
		t.Fatal(err)
	}
	duration := filter.To.Sub(filter.From)
	if duration < 29*24*time.Hour || duration > 31*24*time.Hour {
		t.Fatalf("default duration = %s", duration)
	}
}

func TestNormalizeReportRangeRejectsInvalidOrOversizedRange(t *testing.T) {
	now := time.Now().UTC()
	tests := []MetricsFilter{
		{From: now, To: now},
		{From: now, To: now.Add(-time.Hour)},
		{From: now.AddDate(-2, 0, 0), To: now},
	}
	for _, filter := range tests {
		if _, err := normalizeReportRange(1, filter); err == nil {
			t.Fatalf("normalizeReportRange(%+v) succeeded", filter)
		}
	}
}
