package data

import (
	"encoding/json"
	"fmt"
	"testing"

	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/data/model"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestBindArticleGalleryImagesUsesTaskGallerySelection(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(
		&model.GalleryAlbum{},
		&model.GalleryImage{},
		&model.Article{},
		&model.ArticleImage{},
	); err != nil {
		t.Fatal(err)
	}

	album := model.GalleryAlbum{TenantModel: model.TenantModel{EnterpriseID: 2}, Name: "用户选择的图册", Category: 1, Version: 1}
	if err := db.Create(&album).Error; err != nil {
		t.Fatal(err)
	}
	images := make([]model.GalleryImage, 3)
	for index := range images {
		images[index] = model.GalleryImage{
			TenantModel:  model.TenantModel{EnterpriseID: 2},
			AlbumID:      album.ID,
			OriginalName: fmt.Sprintf("selected-%d.png", index),
			ObjectKey:    fmt.Sprintf("gallery/selected-%d.png", index),
			MimeType:     "image/png",
			ContentHash:  fmt.Sprintf("%064d", index),
			Version:      1,
		}
		if err := db.Create(&images[index]).Error; err != nil {
			t.Fatal(err)
		}
	}
	article := model.Article{TenantModel: model.TenantModel{EnterpriseID: 2}, BrandID: 9, Title: "测试文章", Status: "draft", Source: "ai", Version: 1}
	if err := db.Create(&article).Error; err != nil {
		t.Fatal(err)
	}
	refsJSON, err := json.Marshal([]biz.ArticleGenerationGalleryRef{
		{ImageID: images[2].ID, Placement: biz.ArticleGalleryPlacementCover},
		{ImageID: images[0].ID, Placement: biz.ArticleGalleryPlacementBody, Placeholder: "[[GALLERY_IMAGE_1]]"},
	})
	if err != nil {
		t.Fatal(err)
	}

	if err := bindArticleGalleryImages(db, 2, article.ID, refsJSON); err != nil {
		t.Fatalf("bindArticleGalleryImages() error = %v", err)
	}
	var bindings []model.ArticleImage
	if err := db.Where("article_id = ?", article.ID).Order("sort_order ASC").Find(&bindings).Error; err != nil {
		t.Fatal(err)
	}
	if len(bindings) != 2 {
		t.Fatalf("binding count = %d, want 2", len(bindings))
	}
	if bindings[0].GalleryImageID != images[2].ID || bindings[0].Placement != biz.ArticleGalleryPlacementCover {
		t.Fatalf("cover binding = %#v, want selected image %d", bindings[0], images[2].ID)
	}
	if bindings[1].GalleryImageID != images[0].ID || bindings[1].Placement != biz.ArticleGalleryPlacementBody {
		t.Fatalf("body binding = %#v, want selected image %d", bindings[1], images[0].ID)
	}
	if err := bindArticleGalleryImages(db, 2, article.ID, refsJSON); err != nil {
		t.Fatalf("second bindArticleGalleryImages() error = %v", err)
	}
	var count int64
	if err := db.Model(&model.ArticleImage{}).Where("article_id = ?", article.ID).Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 2 {
		t.Fatalf("binding count after retry = %d, want 2", count)
	}
}
