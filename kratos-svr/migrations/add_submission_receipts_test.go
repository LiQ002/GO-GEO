package migrations

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"kratos-svr/internal/migrate"

	_ "github.com/go-sql-driver/mysql"
)

func TestAddSubmissionReceiptsMigration(t *testing.T) {
	dsn := "root:111222@tcp(127.0.0.1:3306)/geo_test_submission_receipts?charset=utf8mb4&parseTime=True&loc=UTC"
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if _, err := db.ExecContext(ctx, "DROP DATABASE IF EXISTS geo_test_submission_receipts"); err != nil {
		t.Fatalf("drop test database: %v", err)
	}
	if _, err := db.ExecContext(ctx, "CREATE DATABASE geo_test_submission_receipts"); err != nil {
		t.Fatalf("create test database: %v", err)
	}

	if err := migrate.Up(ctx, db, Files); err != nil {
		t.Fatalf("apply migrations: %v", err)
	}

	var tableName string
	if err := db.QueryRowContext(ctx, "SHOW TABLES LIKE 'pub_submission_receipts'").Scan(&tableName); err != nil {
		t.Fatalf("pub_submission_receipts table not found: %v", err)
	}
	if tableName != "pub_submission_receipts" {
		t.Fatalf("unexpected table name: %s", tableName)
	}
}
