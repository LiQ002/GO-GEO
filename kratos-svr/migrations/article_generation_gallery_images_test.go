package migrations

import (
	"strings"
	"testing"
)

func TestArticleGenerationGalleryImagesMigration(t *testing.T) {
	t.Parallel()

	script, err := Files.ReadFile("000026_article_generation_gallery_images.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	sql := string(script)
	for _, fragment := range []string{
		"ALTER TABLE cnt_article_generation_tasks",
		"ALTER TABLE cnt_article_snapshots",
		"ADD COLUMN gallery_refs_json JSON NULL",
	} {
		if !strings.Contains(sql, fragment) {
			t.Errorf("gallery generation migration does not contain %q", fragment)
		}
	}
}
