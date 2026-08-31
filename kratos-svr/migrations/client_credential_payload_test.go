package migrations

import (
	"io/fs"
	"strings"
	"testing"
)

func TestClientCredentialPayloadMigration(t *testing.T) {
	t.Parallel()

	script, err := fs.ReadFile(Files, "000020_store_client_credential_payload.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	content := string(script)
	for _, required := range []string{
		"credential_payload LONGTEXT",
		"ciphertext LONGBLOB NULL",
		"nonce VARBINARY(64) NULL",
		"aad_hash CHAR(64) NULL",
	} {
		if !strings.Contains(content, required) {
			t.Errorf("client credential migration does not contain %q", required)
		}
	}

	downScript, err := fs.ReadFile(Files, "000020_store_client_credential_payload.down.sql")
	if err != nil {
		t.Fatal(err)
	}
	for _, required := range []string{
		"DROP COLUMN credential_payload",
		"ciphertext LONGBLOB NOT NULL",
		"nonce VARBINARY(64) NOT NULL",
		"aad_hash CHAR(64) NOT NULL",
	} {
		if !strings.Contains(string(downScript), required) {
			t.Errorf("client credential rollback does not contain %q", required)
		}
	}
}
