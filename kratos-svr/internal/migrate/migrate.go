// Package migrate applies versioned SQL migrations outside service startup.
package migrate

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io/fs"
	"sort"
	"strconv"
	"strings"
)

const createVersionTable = `CREATE TABLE IF NOT EXISTS schema_migrations (
  version BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`

// Up applies every unapplied *.up.sql file in version order.
func Up(ctx context.Context, db *sql.DB, files fs.FS) error {
	if _, err := db.ExecContext(ctx, createVersionTable); err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}
	entries, err := fs.Glob(files, "*.up.sql")
	if err != nil {
		return fmt.Errorf("list migrations: %w", err)
	}
	sort.Strings(entries)
	for _, name := range entries {
		version, err := versionFromName(name)
		if err != nil {
			return err
		}
		var exists bool
		if err := db.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = ?)", version).Scan(&exists); err != nil {
			return fmt.Errorf("read migration version %d: %w", version, err)
		}
		if exists {
			continue
		}
		script, err := fs.ReadFile(files, name)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", name, err)
		}
		if err := apply(ctx, db, version, string(script)); err != nil {
			return fmt.Errorf("apply migration %s: %w", name, err)
		}
	}
	return nil
}

func apply(ctx context.Context, db *sql.DB, version uint64, script string) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	for _, statement := range strings.Split(script, ";") {
		statement = strings.TrimSpace(statement)
		if statement == "" {
			continue
		}
		if _, err := tx.ExecContext(ctx, statement); err != nil {
			return err
		}
	}
	if _, err := tx.ExecContext(ctx, "INSERT INTO schema_migrations(version) VALUES (?)", version); err != nil {
		return err
	}
	return tx.Commit()
}

func versionFromName(name string) (uint64, error) {
	prefix, _, ok := strings.Cut(name, "_")
	if !ok {
		return 0, errors.New("migration filename must start with a numeric version")
	}
	version, err := strconv.ParseUint(prefix, 10, 64)
	if err != nil || version == 0 {
		return 0, fmt.Errorf("invalid migration filename %q", name)
	}
	return version, nil
}
