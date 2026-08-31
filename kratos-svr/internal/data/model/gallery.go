package model

// GalleryAlbum groups enterprise images under a GEO knowledge category.
type GalleryAlbum struct {
	TenantModel
	Name        string `gorm:"column:name;type:varchar(128);not null"`
	Category    int32  `gorm:"column:category;type:tinyint unsigned;not null;index"`
	Description string `gorm:"column:description;type:varchar(1024)"`
	Version     uint64 `gorm:"column:version;not null;default:1"`
}

func (GalleryAlbum) TableName() string { return TableGalleryAlbums }

// GalleryImage stores metadata for an object persisted by FileStorage.
type GalleryImage struct {
	TenantModel
	AlbumID      uint64 `gorm:"column:album_id;not null;index"`
	OriginalName string `gorm:"column:original_name;type:varchar(255);not null"`
	ObjectKey    string `gorm:"column:object_key;type:varchar(512);not null;uniqueIndex"`
	MimeType     string `gorm:"column:mime_type;type:varchar(128);not null"`
	SizeBytes    int64  `gorm:"column:size_bytes;not null"`
	ContentHash  string `gorm:"column:content_hash;type:char(64);not null;index"`
	Version      uint64 `gorm:"column:version;not null;default:1"`
}

func (GalleryImage) TableName() string { return TableGalleryImages }
