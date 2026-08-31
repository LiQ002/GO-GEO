package data

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"kratos-svr/app/admin/internal/conf"
	"kratos-svr/internal/cryptobox"
	"kratos-svr/internal/event"

	"github.com/google/wire"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// ProviderSet is data providers.
var ProviderSet = wire.NewSet(
	NewData,
	NewAdminAuthRepo,
	NewEnterpriseRepo,
	NewPlanRepo,
	NewAdminArticleRepo,
	NewAdminPublishTaskRepo,
	NewAdminGeoTaskRepo,
	NewWorkerAdminRepo,
	NewWorkerTaskRepo,
	NewAdminAuditLogRepo,
	NewSystemSettingRepo,
	NewDashboardRepo,
	NewAdminAlertRepo,
	NewAdminRoleRepo,
	NewAdminUserRepo,
	NewAdminAuthorizationRepo,
	NewSalesOpportunityRepo,
	NewSalesDiagnosisRepo,
	NewEinoSalesDiagnosisRunner,
	NewArticleTypeRepo,
	NewWritingModelRepo,
	NewPublishChannelRepo,
	NewCustomerAuthorizationRepo,
	NewInclusionSiteRepo,
	NewSubscriptionOrderRepo,
	NewPointsBalanceRepo,
	NewPointsLedgerRepo,
	NewBillingTxRepo,
	NewBillingSchedulerRepo,
	NewRealnameRepo,
)

// Data .
type Data struct {
	db     *gorm.DB
	box    *cryptobox.Box
	broker *event.Broker
}

// NewData opens the admin app connection pool. It never performs migrations.
func NewData(c *conf.Data, appLogger *slog.Logger) (*Data, func(), error) {
	if c == nil || c.Database == nil {
		return nil, nil, errors.New("admin database config is required")
	}
	if !strings.EqualFold(c.Database.Driver, "mysql") {
		return nil, nil, fmt.Errorf("unsupported admin database driver %q", c.Database.Driver)
	}
	box, err := cryptobox.New(c.CredentialEncryptionKey)
	if err != nil {
		return nil, nil, fmt.Errorf("configure admin credential encryption: %w", err)
	}
	slowThreshold := 500 * time.Millisecond
	if c.Database.SlowQueryThreshold != nil {
		slowThreshold = c.Database.SlowQueryThreshold.AsDuration()
	}
	db, err := gorm.Open(mysql.Open(c.Database.Source), &gorm.Config{
		PrepareStmt:    true,
		TranslateError: true,
		Logger: logger.New(&gormLogWriter{logger: appLogger}, logger.Config{
			SlowThreshold: slowThreshold, LogLevel: logger.Warn,
			ParameterizedQueries: true, Colorful: false,
		}),
	})
	if err != nil {
		return nil, nil, fmt.Errorf("open admin database: %w", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		return nil, nil, fmt.Errorf("get admin sql database: %w", err)
	}
	configurePool(sqlDB.SetMaxOpenConns, c.Database.MaxOpenConnections, 50)
	configurePool(sqlDB.SetMaxIdleConns, c.Database.MaxIdleConnections, 10)
	if c.Database.ConnectionMaxLifetime != nil {
		sqlDB.SetConnMaxLifetime(c.Database.ConnectionMaxLifetime.AsDuration())
	}
	if c.Database.ConnectionMaxIdleTime != nil {
		sqlDB.SetConnMaxIdleTime(c.Database.ConnectionMaxIdleTime.AsDuration())
	}
	cleanup := func() {
		if err := sqlDB.Close(); err != nil {
			appLogger.Error("close admin database", slog.Any("error", err))
		}
	}
	// 初始化 Redis 事件代理（用于跨进程推送任务完成事件给 user SSE）
	var broker *event.Broker
	if c.Redis != nil && c.Redis.Addr != "" {
		broker = event.NewBroker(c.Redis.Addr, appLogger)
		if err := broker.Ping(context.Background()); err != nil {
			appLogger.Warn("admin redis ping failed, SSE push disabled", slog.Any("error", err))
			broker = nil
		}
	}
	return &Data{db: db, box: box, broker: broker}, cleanup, nil
}

// DB returns the app-owned database handle for repository implementations.
func (d *Data) DB(ctx context.Context) *gorm.DB { return d.db.WithContext(ctx) }

// WithinTransaction executes a data-layer operation in one transaction.
func (d *Data) WithinTransaction(ctx context.Context, fn func(*gorm.DB) error) error {
	return d.db.WithContext(ctx).Transaction(fn)
}

func (d *Data) sealCredential(plaintext, associatedData []byte) ([]byte, []byte, error) {
	return d.box.Seal(plaintext, associatedData)
}

func (d *Data) openCredential(nonce, ciphertext, associatedData []byte) ([]byte, error) {
	return d.box.Open(nonce, ciphertext, associatedData)
}

type gormLogWriter struct{ logger *slog.Logger }

func (w *gormLogWriter) Printf(format string, args ...any) {
	w.logger.Warn("gorm", slog.String("message", fmt.Sprintf(format, args...)))
}

func configurePool(setter func(int), configured int32, fallback int) {
	if configured > 0 {
		setter(int(configured))
		return
	}
	setter(fallback)
}

func jsonBytes(value string) []byte {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return []byte(value)
}
