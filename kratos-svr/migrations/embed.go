// Package migrations embeds reviewed, versioned MySQL migrations.
package migrations

import "embed"

// Files contains all migration SQL files.
//
//go:embed *.sql
var Files embed.FS
