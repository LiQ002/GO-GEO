package data

import "testing"

func TestExportOutboxKeyIsStableAndBounded(t *testing.T) {
	first := exportOutboxKey("created", 42, "request-id")
	second := exportOutboxKey("created", 42, "request-id")
	if first != second || len(first) > 128 {
		t.Fatalf("outbox key = %q", first)
	}
	if first == exportOutboxKey("created", 43, "request-id") {
		t.Fatal("enterprise id is not included in the outbox key")
	}
}
