package server

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"sync"
	"time"

	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/app/admin/internal/conf"

	"github.com/go-kratos/kratos/v3/transport"
	"golang.org/x/sync/errgroup"
)

const (
	defaultSalesDiagnosisConcurrency = 4
	maxSalesDiagnosisConcurrency     = 32
	defaultSalesDiagnosisPoll        = time.Second
	defaultSalesDiagnosisLease       = 15 * time.Minute
)

// SalesDiagnosisWorker consumes durable question-by-model tasks in the admin process.
type SalesDiagnosisWorker struct {
	uc          *biz.SalesDiagnosisUsecase
	logger      *slog.Logger
	workerBase  string
	concurrency int
	poll        time.Duration
	lease       time.Duration

	mu     sync.Mutex
	cancel context.CancelFunc
	done   chan struct{}
}

var _ transport.Server = (*SalesDiagnosisWorker)(nil)

func NewSalesDiagnosisWorker(c *conf.Data, uc *biz.SalesDiagnosisUsecase, logger *slog.Logger) *SalesDiagnosisWorker {
	concurrency := defaultSalesDiagnosisConcurrency
	poll := defaultSalesDiagnosisPoll
	lease := defaultSalesDiagnosisLease
	if c != nil && c.SalesDiagnosisWorker != nil {
		settings := c.SalesDiagnosisWorker
		if settings.Concurrency > 0 {
			concurrency = min(int(settings.Concurrency), maxSalesDiagnosisConcurrency)
		}
		if settings.PollInterval != nil && settings.PollInterval.AsDuration() > 0 {
			poll = settings.PollInterval.AsDuration()
		}
		if settings.LeaseDuration != nil && settings.LeaseDuration.AsDuration() > 0 {
			lease = settings.LeaseDuration.AsDuration()
		}
	}
	hostname, err := os.Hostname()
	if err != nil || hostname == "" {
		hostname = "admin"
	}
	return &SalesDiagnosisWorker{
		uc: uc, logger: logger, workerBase: fmt.Sprintf("%s-%d", hostname, os.Getpid()),
		concurrency: concurrency, poll: poll, lease: lease, done: make(chan struct{}),
	}
}

// Start blocks while workers consume tasks and exits after Stop cancels them.
func (w *SalesDiagnosisWorker) Start(ctx context.Context) error {
	workerCtx, cancel := context.WithCancel(ctx)
	w.mu.Lock()
	w.cancel = cancel
	w.mu.Unlock()
	defer close(w.done)
	w.logger.Info("sales diagnosis worker started",
		slog.Int("concurrency", w.concurrency),
		slog.Duration("poll_interval", w.poll),
		slog.Duration("lease_duration", w.lease),
	)
	group, groupCtx := errgroup.WithContext(workerCtx)
	group.Go(func() error {
		return w.reconcile(groupCtx)
	})
	for i := range w.concurrency {
		workerID := fmt.Sprintf("%s-%d", w.workerBase, i+1)
		group.Go(func() error {
			return w.run(groupCtx, workerID)
		})
	}
	err := group.Wait()
	w.logger.Info("sales diagnosis worker stopped")
	return err
}

func (w *SalesDiagnosisWorker) reconcile(ctx context.Context) error {
	for {
		processed, err := w.uc.ReconcileNext(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return nil
			}
			w.logger.Warn("reconcile sales diagnosis", slog.Any("error", err))
		}
		if processed && err == nil {
			continue
		}
		if !waitSalesDiagnosisPoll(ctx, w.poll) {
			return nil
		}
	}
}

// Stop cancels workers and waits for in-flight model calls to return.
func (w *SalesDiagnosisWorker) Stop(ctx context.Context) error {
	w.mu.Lock()
	cancel := w.cancel
	w.mu.Unlock()
	if cancel != nil {
		cancel()
	}
	select {
	case <-w.done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (w *SalesDiagnosisWorker) run(ctx context.Context, workerID string) error {
	for {
		processed, err := w.uc.ProcessNext(ctx, workerID, w.lease)
		if err != nil {
			if ctx.Err() != nil {
				return nil
			}
			w.logger.Warn("process sales diagnosis task", slog.String("worker_id", workerID), slog.Any("error", err))
		}
		if processed && err == nil {
			continue
		}
		if !waitSalesDiagnosisPoll(ctx, w.poll) {
			return nil
		}
	}
}

func waitSalesDiagnosisPoll(ctx context.Context, duration time.Duration) bool {
	timer := time.NewTimer(duration)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}
