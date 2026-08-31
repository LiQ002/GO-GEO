package data

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"path"
	"strings"

	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/data/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type galleryRepo struct {
	data    *Data
	storage *FileStorage
}

func NewGalleryRepo(data *Data, storage *FileStorage) biz.GalleryRepo {
	return &galleryRepo{data: data, storage: storage}
}

func (r *galleryRepo) CreateAlbum(ctx context.Context, album *biz.GalleryAlbum) (*biz.GalleryAlbum, error) {
	record := galleryAlbumPO(album)
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		if err := ensureGalleryAlbumNameAvailable(tx, album.EnterpriseID, 0, record.Name); err != nil {
			return err
		}
		return tx.Create(record).Error
	})
	if err != nil {
		return nil, mapGalleryAlbumError(err)
	}
	return r.GetAlbum(ctx, album.EnterpriseID, record.ID)
}

func (r *galleryRepo) GetAlbum(ctx context.Context, enterpriseID, id uint64) (*biz.GalleryAlbum, error) {
	var record model.GalleryAlbum
	if err := r.data.DB(ctx).Where("enterprise_id = ? AND id = ?", enterpriseID, id).First(&record).Error; err != nil {
		return nil, mapGalleryAlbumError(err)
	}
	album := galleryAlbumDO(&record)
	if err := r.hydrateGalleryAlbum(ctx, album); err != nil {
		return nil, err
	}
	return album, nil
}

func (r *galleryRepo) ListAlbums(ctx context.Context, enterpriseID uint64, opts biz.GalleryAlbumListOptions) ([]*biz.GalleryAlbum, int64, error) {
	db := r.data.DB(ctx).Model(&model.GalleryAlbum{}).Where("enterprise_id = ?", enterpriseID)
	if opts.Category != 0 {
		db = db.Where("category = ?", opts.Category)
	}
	if keyword := strings.TrimSpace(opts.Keyword); keyword != "" {
		like := "%" + keyword + "%"
		db = db.Where("name LIKE ? OR description LIKE ?", like, like)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var records []model.GalleryAlbum
	if err := db.Order("created_at DESC, id DESC").Offset(opts.Offset).Limit(opts.Limit).Find(&records).Error; err != nil {
		return nil, 0, err
	}
	items := make([]*biz.GalleryAlbum, 0, len(records))
	for i := range records {
		album := galleryAlbumDO(&records[i])
		if err := r.hydrateGalleryAlbum(ctx, album); err != nil {
			return nil, 0, err
		}
		items = append(items, album)
	}
	return items, total, nil
}

func (r *galleryRepo) UpdateAlbum(ctx context.Context, album *biz.GalleryAlbum) (*biz.GalleryAlbum, error) {
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		if err := ensureGalleryAlbumNameAvailable(tx, album.EnterpriseID, album.ID, strings.TrimSpace(album.Name)); err != nil {
			return err
		}
		result := tx.Model(&model.GalleryAlbum{}).
			Where("enterprise_id = ? AND id = ? AND version = ?", album.EnterpriseID, album.ID, album.Version).
			Updates(map[string]any{
				"name":        strings.TrimSpace(album.Name),
				"category":    album.Category,
				"description": strings.TrimSpace(album.Description),
				"version":     gorm.Expr("version + 1"),
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return biz.ErrGalleryAlbumConflict
		}
		return nil
	})
	if err != nil {
		return nil, mapGalleryAlbumError(err)
	}
	return r.GetAlbum(ctx, album.EnterpriseID, album.ID)
}

func (r *galleryRepo) DeleteAlbum(ctx context.Context, enterpriseID, id, version uint64) error {
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var album model.GalleryAlbum
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("enterprise_id = ? AND id = ? AND version = ?", enterpriseID, id, version).
			First(&album).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return biz.ErrGalleryAlbumConflict
			}
			return err
		}
		var imageCount int64
		if err := tx.Model(&model.GalleryImage{}).
			Where("enterprise_id = ? AND album_id = ?", enterpriseID, id).
			Count(&imageCount).Error; err != nil {
			return err
		}
		if imageCount != 0 {
			return biz.ErrGalleryAlbumNotEmpty
		}
		return tx.Delete(&album).Error
	})
	return mapGalleryAlbumError(err)
}

func (r *galleryRepo) CreateImage(ctx context.Context, image *biz.GalleryImage) (*biz.GalleryImage, error) {
	if err := requireGalleryAlbum(r.data.DB(ctx), image.EnterpriseID, image.AlbumID); err != nil {
		return nil, err
	}
	logicalKey, err := newGalleryObjectKey(image)
	if err != nil {
		return nil, biz.ErrGalleryImageStorage
	}
	objectKey, err := r.storage.Put(ctx, logicalKey, image.MimeType, image.Content)
	if err != nil {
		return nil, biz.ErrGalleryImageStorage
	}
	record := galleryImagePO(image, objectKey)
	if err := r.data.DB(ctx).Create(record).Error; err != nil {
		_ = r.storage.Delete(ctx, objectKey)
		return nil, mapGalleryImageError(err)
	}
	return r.galleryImageDO(record), nil
}

func (r *galleryRepo) ListImages(ctx context.Context, enterpriseID uint64, opts biz.GalleryImageListOptions) ([]*biz.GalleryImage, int64, error) {
	if opts.AlbumID != 0 {
		if err := requireGalleryAlbum(r.data.DB(ctx), enterpriseID, opts.AlbumID); err != nil {
			return nil, 0, err
		}
	}
	db := r.data.DB(ctx).Model(&model.GalleryImage{}).Where("enterprise_id = ?", enterpriseID)
	if opts.AlbumID != 0 {
		db = db.Where("album_id = ?", opts.AlbumID)
	}
	if keyword := strings.TrimSpace(opts.Keyword); keyword != "" {
		db = db.Where("original_name LIKE ?", "%"+keyword+"%")
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var records []model.GalleryImage
	if err := db.Order("created_at DESC, id DESC").Offset(opts.Offset).Limit(opts.Limit).Find(&records).Error; err != nil {
		return nil, 0, err
	}
	items := make([]*biz.GalleryImage, 0, len(records))
	for i := range records {
		items = append(items, r.galleryImageDO(&records[i]))
	}
	return items, total, nil
}

func (r *galleryRepo) DeleteImage(ctx context.Context, enterpriseID, id, version uint64) error {
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var record model.GalleryImage
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("enterprise_id = ? AND id = ? AND version = ?", enterpriseID, id, version).
			First(&record).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return biz.ErrGalleryImageConflict
			}
			return err
		}
		if err := r.storage.Delete(ctx, record.ObjectKey); err != nil {
			return biz.ErrGalleryImageStorage
		}
		return tx.Delete(&record).Error
	})
	return mapGalleryImageError(err)
}

func (r *galleryRepo) hydrateGalleryAlbum(ctx context.Context, album *biz.GalleryAlbum) error {
	db := r.data.DB(ctx).Model(&model.GalleryImage{}).
		Where("enterprise_id = ? AND album_id = ?", album.EnterpriseID, album.ID)
	if err := db.Count(&album.ImageCount).Error; err != nil {
		return err
	}
	if album.ImageCount == 0 {
		return nil
	}
	var cover model.GalleryImage
	if err := db.Select("object_key").Order("created_at DESC, id DESC").First(&cover).Error; err != nil {
		return err
	}
	album.CoverImageURL = r.storage.PublicURL(cover.ObjectKey)
	return nil
}

func (r *galleryRepo) galleryImageDO(record *model.GalleryImage) *biz.GalleryImage {
	return &biz.GalleryImage{
		ID:           record.ID,
		EnterpriseID: record.EnterpriseID,
		AlbumID:      record.AlbumID,
		OriginalName: record.OriginalName,
		ObjectKey:    record.ObjectKey,
		URL:          r.storage.PublicURL(record.ObjectKey),
		MimeType:     record.MimeType,
		SizeBytes:    record.SizeBytes,
		ContentHash:  record.ContentHash,
		Version:      record.Version,
		CreatedAt:    record.CreatedAt,
	}
}

func galleryAlbumPO(album *biz.GalleryAlbum) *model.GalleryAlbum {
	return &model.GalleryAlbum{
		TenantModel: model.TenantModel{EnterpriseID: album.EnterpriseID},
		Name:        strings.TrimSpace(album.Name),
		Category:    album.Category,
		Description: strings.TrimSpace(album.Description),
		Version:     1,
	}
}

func galleryAlbumDO(record *model.GalleryAlbum) *biz.GalleryAlbum {
	return &biz.GalleryAlbum{
		ID:           record.ID,
		EnterpriseID: record.EnterpriseID,
		Name:         record.Name,
		Category:     record.Category,
		Description:  record.Description,
		Version:      record.Version,
		CreatedAt:    record.CreatedAt,
		UpdatedAt:    record.UpdatedAt,
	}
}

func galleryImagePO(image *biz.GalleryImage, objectKey string) *model.GalleryImage {
	return &model.GalleryImage{
		TenantModel:  model.TenantModel{EnterpriseID: image.EnterpriseID},
		AlbumID:      image.AlbumID,
		OriginalName: image.OriginalName,
		ObjectKey:    objectKey,
		MimeType:     image.MimeType,
		SizeBytes:    image.SizeBytes,
		ContentHash:  image.ContentHash,
		Version:      1,
	}
}

func ensureGalleryAlbumNameAvailable(db *gorm.DB, enterpriseID, excludingID uint64, name string) error {
	query := db.Model(&model.GalleryAlbum{}).
		Where("enterprise_id = ? AND name = ?", enterpriseID, strings.TrimSpace(name))
	if excludingID != 0 {
		query = query.Where("id <> ?", excludingID)
	}
	var count int64
	if err := query.Count(&count).Error; err != nil {
		return err
	}
	if count != 0 {
		return biz.ErrGalleryAlbumConflict
	}
	return nil
}

func requireGalleryAlbum(db *gorm.DB, enterpriseID, albumID uint64) error {
	var count int64
	if err := db.Model(&model.GalleryAlbum{}).
		Where("enterprise_id = ? AND id = ?", enterpriseID, albumID).
		Count(&count).Error; err != nil {
		return err
	}
	if count != 1 {
		return biz.ErrGalleryAlbumNotFound
	}
	return nil
}

func newGalleryObjectKey(image *biz.GalleryImage) (string, error) {
	random := make([]byte, 16)
	if _, err := rand.Read(random); err != nil {
		return "", fmt.Errorf("generate gallery object key: %w", err)
	}
	extension := map[string]string{
		"image/jpeg": ".jpg",
		"image/png":  ".png",
		"image/gif":  ".gif",
		"image/webp": ".webp",
	}[image.MimeType]
	return path.Join("gallery", fmt.Sprint(image.EnterpriseID), fmt.Sprint(image.AlbumID), hex.EncodeToString(random)+extension), nil
}

func mapGalleryAlbumError(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return biz.ErrGalleryAlbumNotFound
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return biz.ErrGalleryAlbumConflict
	}
	return err
}

func mapGalleryImageError(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return biz.ErrGalleryImageNotFound
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return biz.ErrGalleryImageConflict
	}
	return err
}
