package model

// KnowledgeBase groups evidence sources for an enterprise.
type KnowledgeBase struct {
	TenantModel
	Name        string `gorm:"column:name;type:varchar(128);not null"`
	Description string `gorm:"column:description;type:varchar(1024)"`
	Status      int32  `gorm:"column:status;type:tinyint unsigned;not null;index"`
	Version     uint64 `gorm:"column:version;not null;default:1"`
}

func (KnowledgeBase) TableName() string { return TableKnowledgeBases }

// KnowledgeDocument is a versioned uploaded, crawled, or entered source.
type KnowledgeDocument struct {
	TenantModel
	KnowledgeBaseID uint64 `gorm:"column:knowledge_base_id;not null;index"`
	Category        int32  `gorm:"column:category;type:tinyint unsigned;not null;default:1;index"`
	Title           string `gorm:"column:title;type:varchar(255);not null"`
	Content         string `gorm:"column:content;type:longtext"`
	SourceType      int32  `gorm:"column:source_type;type:tinyint unsigned;not null"`
	SourceURL       string `gorm:"column:source_url;type:varchar(2048)"`
	ObjectKey       string `gorm:"column:object_key;type:varchar(1024)"`
	ContentHash     string `gorm:"column:content_hash;type:char(64);index"`
	MimeType        string `gorm:"column:mime_type;type:varchar(128)"`
	ParseStatus     int32  `gorm:"column:parse_status;type:tinyint unsigned;not null;index"`
	ParseError      string `gorm:"column:parse_error;type:text"`
	DocumentVersion uint32 `gorm:"column:document_version;not null;default:1"`
	MetadataJSON    []byte `gorm:"column:metadata_json;type:json"`
}

func (KnowledgeDocument) TableName() string { return TableKnowledgeDocuments }

// KnowledgeChunk is a traceable parsed document fragment.
type KnowledgeChunk struct {
	ImmutableTenantModel
	KnowledgeDocumentID uint64 `gorm:"column:knowledge_document_id;not null;index"`
	DocumentVersion     uint32 `gorm:"column:document_version;not null"`
	ChunkIndex          uint32 `gorm:"column:chunk_index;not null"`
	Content             string `gorm:"column:content;type:longtext;not null"`
	ContentHash         string `gorm:"column:content_hash;type:char(64);not null;index"`
	LocatorJSON         []byte `gorm:"column:locator_json;type:json"`
	MetadataJSON        []byte `gorm:"column:metadata_json;type:json"`
}

func (KnowledgeChunk) TableName() string { return TableKnowledgeChunks }
