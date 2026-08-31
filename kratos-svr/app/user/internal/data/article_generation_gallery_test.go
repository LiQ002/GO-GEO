package data

import (
	"context"
	"errors"
	"reflect"
	"strconv"
	"testing"

	"kratos-svr/app/user/internal/biz"
	"kratos-svr/app/user/internal/conf"
	"kratos-svr/internal/data/model"
)

func TestSelectGalleryImagesIsTenantScopedAndDeterministic(t *testing.T) {
	t.Parallel()

	db := openKnowledgeTestDB(t)
	if err := db.AutoMigrate(&model.GalleryAlbum{}, &model.GalleryImage{}); err != nil {
		t.Fatal(err)
	}
	album := model.GalleryAlbum{
		TenantModel: model.TenantModel{EnterpriseID: 18},
		Name:        "产品图库",
		Category:    biz.KnowledgeCategoryProductOverview,
		Version:     1,
	}
	if err := db.Create(&album).Error; err != nil {
		t.Fatal(err)
	}
	otherAlbum := model.GalleryAlbum{
		TenantModel: model.TenantModel{EnterpriseID: 19},
		Name:        "其他企业图库",
		Category:    biz.KnowledgeCategoryProductOverview,
		Version:     1,
	}
	if err := db.Create(&otherAlbum).Error; err != nil {
		t.Fatal(err)
	}
	for index := 1; index <= 5; index++ {
		image := model.GalleryImage{
			TenantModel:  model.TenantModel{EnterpriseID: 18},
			AlbumID:      album.ID,
			OriginalName: "image.png",
			ObjectKey:    "gallery/18/image-" + strconv.Itoa(index) + ".png",
			MimeType:     "image/png",
			SizeBytes:    100,
			ContentHash:  "hash-" + strconv.Itoa(index),
			Version:      1,
		}
		if err := db.Create(&image).Error; err != nil {
			t.Fatal(err)
		}
	}
	storage, err := NewFileStorage(&conf.Storage{
		Driver: fileStorageDriverLocal,
		Local:  &conf.Storage_Local{Root: t.TempDir(), PublicBaseUrl: "https://assets.example.com"},
	})
	if err != nil {
		t.Fatal(err)
	}
	repo := &articleGenerationRepo{data: &Data{db: db}, storage: storage}
	input := biz.ArticleGenerationInput{
		EnterpriseID:      18,
		ClientRequestID:   "request-1",
		GalleryAlbumIDs:   []uint64{album.ID},
		GalleryImageCount: 3,
	}
	first, err := repo.selectGalleryImages(db.WithContext(context.Background()), input)
	if err != nil {
		t.Fatal(err)
	}
	second, err := repo.selectGalleryImages(db.WithContext(context.Background()), input)
	if err != nil {
		t.Fatal(err)
	}
	if len(first) != 3 || !reflect.DeepEqual(first, second) {
		t.Fatalf("selected images are not deterministic: first=%#v second=%#v", first, second)
	}
	for index, ref := range first {
		if ref.AlbumID != album.ID || ref.URL == "" || (ref.Placement != biz.ArticleGalleryPlacementCover && ref.Placeholder == "") {
			t.Fatalf("selected ref %d = %#v", index, ref)
		}
	}
	input.GalleryAlbumIDs = []uint64{otherAlbum.ID}
	if _, err := repo.selectGalleryImages(db, input); !errors.Is(err, biz.ErrArticleGenerationGallery) {
		t.Fatalf("cross-enterprise gallery error = %v", err)
	}
}
