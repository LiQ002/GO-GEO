package biz

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"mime"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-kratos/kratos/v3/errors"
)

const MaxGalleryImageSize int64 = 10 << 20

var (
	ErrGalleryAlbumNotFound = errors.NotFound("GALLERY_ALBUM_NOT_FOUND", "gallery album not found")
	ErrGalleryAlbumInvalid  = errors.BadRequest("GALLERY_ALBUM_INVALID", "invalid gallery album")
	ErrGalleryAlbumConflict = errors.Conflict("GALLERY_ALBUM_CONFLICT", "gallery album version or name conflict")
	ErrGalleryAlbumNotEmpty = errors.Conflict("GALLERY_ALBUM_NOT_EMPTY", "gallery album still contains images")
	ErrGalleryImageNotFound = errors.NotFound("GALLERY_IMAGE_NOT_FOUND", "gallery image not found")
	ErrGalleryImageInvalid  = errors.BadRequest("GALLERY_IMAGE_INVALID", "invalid gallery image")
	ErrGalleryImageConflict = errors.Conflict("GALLERY_IMAGE_CONFLICT", "gallery image version conflict")
	ErrGalleryImageStorage  = errors.InternalServer("GALLERY_IMAGE_STORAGE_ERROR", "gallery image storage failed")
)

type GalleryAlbum struct {
	ID            uint64
	EnterpriseID  uint64
	Name          string
	Category      int32
	Description   string
	Version       uint64
	ImageCount    int64
	CoverImageURL string
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type GalleryAlbumListOptions struct {
	Offset   int
	Limit    int
	Category int32
	Keyword  string
}

type GalleryImage struct {
	ID           uint64
	EnterpriseID uint64
	AlbumID      uint64
	OriginalName string
	ObjectKey    string
	URL          string
	MimeType     string
	SizeBytes    int64
	ContentHash  string
	Version      uint64
	Content      []byte
	CreatedAt    time.Time
}

type GalleryImageListOptions struct {
	Offset  int
	Limit   int
	AlbumID uint64
	Keyword string
}

type GalleryRepo interface {
	CreateAlbum(context.Context, *GalleryAlbum) (*GalleryAlbum, error)
	GetAlbum(context.Context, uint64, uint64) (*GalleryAlbum, error)
	ListAlbums(context.Context, uint64, GalleryAlbumListOptions) ([]*GalleryAlbum, int64, error)
	UpdateAlbum(context.Context, *GalleryAlbum) (*GalleryAlbum, error)
	DeleteAlbum(context.Context, uint64, uint64, uint64) error

	CreateImage(context.Context, *GalleryImage) (*GalleryImage, error)
	ListImages(context.Context, uint64, GalleryImageListOptions) ([]*GalleryImage, int64, error)
	DeleteImage(context.Context, uint64, uint64, uint64) error
}

type GalleryUsecase struct {
	repo GalleryRepo
}

func NewGalleryUsecase(repo GalleryRepo) *GalleryUsecase {
	return &GalleryUsecase{repo: repo}
}

func (u *GalleryUsecase) CreateAlbum(ctx context.Context, album *GalleryAlbum) (*GalleryAlbum, error) {
	if album != nil && album.Category == 0 {
		album.Category = KnowledgeCategoryEnterpriseProfile
	}
	if err := validateGalleryAlbum(album, false); err != nil {
		return nil, err
	}
	return u.repo.CreateAlbum(ctx, album)
}

func (u *GalleryUsecase) GetAlbum(ctx context.Context, enterpriseID, id uint64) (*GalleryAlbum, error) {
	if enterpriseID == 0 || id == 0 {
		return nil, ErrGalleryAlbumInvalid
	}
	return u.repo.GetAlbum(ctx, enterpriseID, id)
}

func (u *GalleryUsecase) ListAlbums(ctx context.Context, enterpriseID uint64, opts GalleryAlbumListOptions) ([]*GalleryAlbum, int64, error) {
	if enterpriseID == 0 || (opts.Category != 0 && !validKnowledgeCategory(opts.Category)) {
		return nil, 0, ErrGalleryAlbumInvalid
	}
	return u.repo.ListAlbums(ctx, enterpriseID, opts)
}

func (u *GalleryUsecase) UpdateAlbum(ctx context.Context, album *GalleryAlbum) (*GalleryAlbum, error) {
	if err := validateGalleryAlbum(album, true); err != nil {
		return nil, err
	}
	return u.repo.UpdateAlbum(ctx, album)
}

func (u *GalleryUsecase) DeleteAlbum(ctx context.Context, enterpriseID, id, version uint64) error {
	if enterpriseID == 0 || id == 0 || version == 0 {
		return ErrGalleryAlbumInvalid
	}
	return u.repo.DeleteAlbum(ctx, enterpriseID, id, version)
}

func (u *GalleryUsecase) UploadImage(ctx context.Context, image *GalleryImage) (*GalleryImage, error) {
	if err := prepareGalleryImage(image); err != nil {
		return nil, err
	}
	return u.repo.CreateImage(ctx, image)
}

func (u *GalleryUsecase) ListImages(ctx context.Context, enterpriseID uint64, opts GalleryImageListOptions) ([]*GalleryImage, int64, error) {
	if enterpriseID == 0 {
		return nil, 0, ErrGalleryImageInvalid
	}
	return u.repo.ListImages(ctx, enterpriseID, opts)
}

func (u *GalleryUsecase) DeleteImage(ctx context.Context, enterpriseID, id, version uint64) error {
	if enterpriseID == 0 || id == 0 || version == 0 {
		return ErrGalleryImageInvalid
	}
	return u.repo.DeleteImage(ctx, enterpriseID, id, version)
}

func validateGalleryAlbum(album *GalleryAlbum, update bool) error {
	if album == nil || album.EnterpriseID == 0 {
		return ErrGalleryAlbumInvalid
	}
	name := strings.TrimSpace(album.Name)
	description := strings.TrimSpace(album.Description)
	if name == "" || utf8.RuneCountInString(name) > 128 || utf8.RuneCountInString(description) > 1024 {
		return ErrGalleryAlbumInvalid
	}
	if !validKnowledgeCategory(album.Category) {
		return ErrGalleryAlbumInvalid
	}
	if update && (album.ID == 0 || album.Version == 0) {
		return ErrGalleryAlbumInvalid
	}
	return nil
}

func prepareGalleryImage(image *GalleryImage) error {
	if image == nil || image.EnterpriseID == 0 || image.AlbumID == 0 {
		return ErrGalleryImageInvalid
	}
	name := strings.TrimSpace(image.OriginalName)
	if name == "" || utf8.RuneCountInString(name) > 255 || len(image.Content) == 0 || int64(len(image.Content)) > MaxGalleryImageSize {
		return ErrGalleryImageInvalid
	}
	detectedType := http.DetectContentType(image.Content)
	if !validGalleryImageMimeType(detectedType) {
		return ErrGalleryImageInvalid
	}
	if declaredType := strings.TrimSpace(image.MimeType); declaredType != "" {
		mediaType, _, err := mime.ParseMediaType(declaredType)
		if err != nil || !strings.EqualFold(mediaType, detectedType) {
			return ErrGalleryImageInvalid
		}
	}
	sum := sha256.Sum256(image.Content)
	image.OriginalName = name
	image.MimeType = detectedType
	image.SizeBytes = int64(len(image.Content))
	image.ContentHash = hex.EncodeToString(sum[:])
	return nil
}

func validGalleryImageMimeType(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "image/jpeg", "image/png", "image/gif", "image/webp":
		return true
	default:
		return false
	}
}
