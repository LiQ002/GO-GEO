package biz

import (
	"context"
	"errors"
	"testing"
)

type galleryRepoStub struct {
	album *GalleryAlbum
	image *GalleryImage
}

func (r *galleryRepoStub) CreateAlbum(_ context.Context, album *GalleryAlbum) (*GalleryAlbum, error) {
	r.album = album
	return album, nil
}
func (*galleryRepoStub) GetAlbum(context.Context, uint64, uint64) (*GalleryAlbum, error) {
	return nil, errors.New("not implemented")
}
func (*galleryRepoStub) ListAlbums(context.Context, uint64, GalleryAlbumListOptions) ([]*GalleryAlbum, int64, error) {
	return nil, 0, nil
}
func (*galleryRepoStub) UpdateAlbum(context.Context, *GalleryAlbum) (*GalleryAlbum, error) {
	return nil, errors.New("not implemented")
}
func (*galleryRepoStub) DeleteAlbum(context.Context, uint64, uint64, uint64) error {
	return nil
}
func (r *galleryRepoStub) CreateImage(_ context.Context, image *GalleryImage) (*GalleryImage, error) {
	r.image = image
	return image, nil
}
func (*galleryRepoStub) ListImages(context.Context, uint64, GalleryImageListOptions) ([]*GalleryImage, int64, error) {
	return nil, 0, nil
}
func (*galleryRepoStub) DeleteImage(context.Context, uint64, uint64, uint64) error {
	return nil
}

func TestGalleryUsecaseDefaultsAlbumCategory(t *testing.T) {
	t.Parallel()

	repo := &galleryRepoStub{}
	usecase := NewGalleryUsecase(repo)
	_, err := usecase.CreateAlbum(context.Background(), &GalleryAlbum{
		EnterpriseID: 7,
		Name:         "公司形象",
	})
	if err != nil {
		t.Fatal(err)
	}
	if repo.album.Category != KnowledgeCategoryEnterpriseProfile {
		t.Fatalf("category = %d", repo.album.Category)
	}
}

func TestGalleryUsecasePreparesImageMetadata(t *testing.T) {
	t.Parallel()

	repo := &galleryRepoStub{}
	usecase := NewGalleryUsecase(repo)
	content := []byte{
		0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
		0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
	}
	_, err := usecase.UploadImage(context.Background(), &GalleryImage{
		EnterpriseID: 7,
		AlbumID:      3,
		OriginalName: " logo.png ",
		MimeType:     "image/png",
		Content:      content,
	})
	if err != nil {
		t.Fatal(err)
	}
	if repo.image.OriginalName != "logo.png" || repo.image.MimeType != "image/png" {
		t.Fatalf("prepared image = %#v", repo.image)
	}
	if repo.image.SizeBytes != int64(len(content)) || len(repo.image.ContentHash) != 64 {
		t.Fatalf("prepared image metadata = %#v", repo.image)
	}
}

func TestGalleryUsecaseRejectsUnsupportedOrOversizedImages(t *testing.T) {
	t.Parallel()

	usecase := NewGalleryUsecase(&galleryRepoStub{})
	for _, image := range []*GalleryImage{
		{EnterpriseID: 1, AlbumID: 1, OriginalName: "note.txt", Content: []byte("not an image")},
		{EnterpriseID: 1, AlbumID: 1, OriginalName: "huge.png", Content: make([]byte, MaxGalleryImageSize+1)},
	} {
		if _, err := usecase.UploadImage(context.Background(), image); !errors.Is(err, ErrGalleryImageInvalid) {
			t.Fatalf("UploadImage() error = %v", err)
		}
	}
}
