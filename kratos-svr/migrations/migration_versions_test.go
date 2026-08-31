package migrations

import (
	"io/fs"
	"strings"
	"testing"
)

func TestMigrationVersionsAreUnique(t *testing.T) {
	t.Parallel()

	files, err := fs.Glob(Files, "*.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	byVersion := make(map[string]string, len(files))
	for _, name := range files {
		version, _, ok := strings.Cut(name, "_")
		if !ok {
			t.Fatalf("migration filename has no version prefix: %s", name)
		}
		if previous, duplicate := byVersion[version]; duplicate {
			t.Fatalf("migration version %s is used by both %s and %s", version, previous, name)
		}
		byVersion[version] = name
	}
}
