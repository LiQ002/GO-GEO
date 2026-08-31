package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"os"
	"time"

	"kratos-svr/internal/migrate"
	"kratos-svr/migrations"

	_ "github.com/go-sql-driver/mysql"
)

func main() {
	var dsn string
	flag.StringVar(&dsn, "dsn", "", "MySQL DSN; prefer injecting through the deployment secret store")
	flag.Parse()
	dsn = selectDSN(dsn, os.Getenv("GEO_DATABASE_DSN"))
	if dsn == "" {
		panic("database DSN is required via -dsn or GEO_DATABASE_DSN")
	}
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		panic(err)
	}
	defer db.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	if err := migrate.Up(ctx, db, migrations.Files); err != nil {
		panic(err)
	}
	fmt.Println("database migrations applied")
}

func selectDSN(flagDSN, environmentDSN string) string {
	if flagDSN != "" {
		return flagDSN
	}
	return environmentDSN
}
