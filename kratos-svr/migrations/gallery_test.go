package migrations

import (
	"strings"
	"testing"
)

func TestEnterpriseGalleryMigrationCreatesAlbumAndImageTables(t *testing.T) {
	t.Parallel()

	script, err := Files.ReadFile("000023_enterprise_gallery.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	sql := string(script)
	for _, fragment := range []string{
		"CREATE TABLE IF NOT EXISTS cnt_gallery_albums",
		"CREATE TABLE IF NOT EXISTS cnt_gallery_images",
		"FOREIGN KEY (album_id) REFERENCES cnt_gallery_albums",
		"object_key VARCHAR(512) COLLATE utf8mb4_bin NOT NULL",
		"UNIQUE KEY uk_gallery_image_object_key",
	} {
		if !strings.Contains(sql, fragment) {
			t.Errorf("gallery migration does not contain %q", fragment)
		}
	}
}
