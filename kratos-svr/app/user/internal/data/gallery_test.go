package data

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"kratos-svr/app/user/internal/biz"
	"kratos-svr/app/user/internal/conf"
	"kratos-svr/internal/data/model"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestGalleryRepoAlbumImageLifecycle(t *testing.T) {
	t.Parallel()

	repo, storageRoot := openGalleryTestRepo(t)
	ctx := context.Background()
	album, err := repo.CreateAlbum(ctx, &biz.GalleryAlbum{
		EnterpriseID: 3,
		Name:         "产品素材",
		Category:     biz.KnowledgeCategoryProductOverview,
	})
	if err != nil {
		t.Fatal(err)
	}
	content := validPNGContent()
	image, err := repo.CreateImage(ctx, &biz.GalleryImage{
		EnterpriseID: 3,
		AlbumID:      album.ID,
		OriginalName: "product.png",
		MimeType:     "image/png",
		SizeBytes:    int64(len(content)),
		ContentHash:  "hash",
		Content:      content,
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(storageRoot, filepath.FromSlash(image.ObjectKey))); err != nil {
		t.Fatalf("stored image is missing: %v", err)
	}
	loaded, err := repo.GetAlbum(ctx, 3, album.ID)
	if err != nil {
		t.Fatal(err)
	}
	if loaded.ImageCount != 1 || loaded.CoverImageURL == "" {
		t.Fatalf("hydrated album = %#v", loaded)
	}
	if err := repo.DeleteAlbum(ctx, 3, album.ID, album.Version); !errors.Is(err, biz.ErrGalleryAlbumNotEmpty) {
		t.Fatalf("DeleteAlbum() error = %v", err)
	}
	if err := repo.DeleteImage(ctx, 3, image.ID, image.Version); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(storageRoot, filepath.FromSlash(image.ObjectKey))); !os.IsNotExist(err) {
		t.Fatalf("deleted image still exists: %v", err)
	}
	if err := repo.DeleteAlbum(ctx, 3, album.ID, album.Version); err != nil {
		t.Fatal(err)
	}
}

func TestGalleryRepoKeepsEnterpriseBoundaries(t *testing.T) {
	t.Parallel()

	repo, _ := openGalleryTestRepo(t)
	album, err := repo.CreateAlbum(context.Background(), &biz.GalleryAlbum{
		EnterpriseID: 10,
		Name:         "品牌素材",
		Category:     biz.KnowledgeCategoryBrandPositioning,
	})
	if err != nil {
		t.Fatal(err)
	}
	_, err = repo.CreateImage(context.Background(), &biz.GalleryImage{
		EnterpriseID: 11,
		AlbumID:      album.ID,
		OriginalName: "brand.png",
		MimeType:     "image/png",
		Content:      validPNGContent(),
	})
	if !errors.Is(err, biz.ErrGalleryAlbumNotFound) {
		t.Fatalf("CreateImage() cross-enterprise error = %v", err)
	}
}

func openGalleryTestRepo(t *testing.T) (*galleryRepo, string) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{TranslateError: true})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.GalleryAlbum{}, &model.GalleryImage{}); err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	storage, err := NewFileStorage(&conf.Storage{
		Driver: fileStorageDriverLocal,
		Local:  &conf.Storage_Local{Root: root},
	})
	if err != nil {
		t.Fatal(err)
	}
	return &galleryRepo{data: &Data{db: db}, storage: storage}, root
}

func validPNGContent() []byte {
	return []byte{
		0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
		0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
	}
}
