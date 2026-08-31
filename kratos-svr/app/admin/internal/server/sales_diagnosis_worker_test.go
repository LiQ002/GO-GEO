package server

import (
	"log/slog"
	"testing"
	"time"

	"kratos-svr/app/admin/internal/conf"

	"google.golang.org/protobuf/types/known/durationpb"
)

func TestNewSalesDiagnosisWorkerDefaultsAndLimits(t *testing.T) {
	t.Parallel()

	logger := slog.New(slog.DiscardHandler)
	defaultWorker := NewSalesDiagnosisWorker(nil, nil, logger)
	if defaultWorker.concurrency != defaultSalesDiagnosisConcurrency || defaultWorker.poll != time.Second {
		t.Fatalf("default worker = %#v", defaultWorker)
	}
	configured := NewSalesDiagnosisWorker(&conf.Data{SalesDiagnosisWorker: &conf.Data_SalesDiagnosisWorker{
		Concurrency: 100, PollInterval: durationpb.New(2 * time.Second), LeaseDuration: durationpb.New(time.Hour),
	}}, nil, logger)
	if configured.concurrency != maxSalesDiagnosisConcurrency || configured.poll != 2*time.Second || configured.lease != time.Hour {
		t.Fatalf("configured worker = %#v", configured)
	}
}
