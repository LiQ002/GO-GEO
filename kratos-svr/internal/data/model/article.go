package model

import "time"

// Article is the mutable article aggregate root.
type Article struct {
	TenantModel
	BrandID           uint64     `gorm:"column:brand_id;not null;index"`
	ArticleTypeID     *uint64    `gorm:"column:article_type_id;index"`
	Title             string     `gorm:"column:title;type:varchar(512);not null"`
	Summary           string     `gorm:"column:summary;type:text"`
	ContentMarkdown   string     `gorm:"column:content_markdown;type:longtext"`
	ContentHTML       string     `gorm:"column:content_html;type:longtext"`
	Status            string     `gorm:"column:status;type:varchar(32);not null;index"`
	Source            string     `gorm:"column:source;type:varchar(32);not null;index"`
	CurrentVersionID  *uint64    `gorm:"column:current_version_id;index"`
	LatestSnapshotID  *uint64    `gorm:"column:latest_snapshot_id;index"`
	QualityScore      float64    `gorm:"column:quality_score;type:decimal(6,3);not null;default:0"`
	QualityResultJSON []byte     `gorm:"column:quality_result_json;type:json"`
	PublishedAt       *time.Time `gorm:"column:published_at;index"`
	Version           uint64     `gorm:"column:version;not null;default:1"`
}

func (Article) TableName() string { return TableArticles }

// ArticleVersion is immutable article content history.
type ArticleVersion struct {
	ImmutableTenantModel
	ArticleID       uint64 `gorm:"column:article_id;not null;index"`
	VersionNumber   uint32 `gorm:"column:version_number;not null"`
	Title           string `gorm:"column:title;type:varchar(512);not null"`
	Summary         string `gorm:"column:summary;type:text"`
	ContentMarkdown string `gorm:"column:content_markdown;type:longtext"`
	ContentHTML     string `gorm:"column:content_html;type:longtext"`
	ChangeSource    string `gorm:"column:change_source;type:varchar(32);not null"`
	ChangeSummary   string `gorm:"column:change_summary;type:varchar(1024)"`
	OperatorType    string `gorm:"column:operator_type;type:varchar(32);not null"`
	OperatorID      uint64 `gorm:"column:operator_id;not null"`
	ContentHash     string `gorm:"column:content_hash;type:char(64);not null"`
}

func (ArticleVersion) TableName() string { return TableArticleVersions }

// ArticleReview is an append-only review decision.
type ArticleReview struct {
	ImmutableTenantModel
	ArticleID    uint64 `gorm:"column:article_id;not null;index"`
	Action       string `gorm:"column:action;type:varchar(32);not null"`
	FromStatus   string `gorm:"column:from_status;type:varchar(32);not null"`
	ToStatus     string `gorm:"column:to_status;type:varchar(32);not null"`
	ReviewerType string `gorm:"column:reviewer_type;type:varchar(32);not null"`
	ReviewerID   uint64 `gorm:"column:reviewer_id;not null"`
	Reason       string `gorm:"column:reason;type:text"`
}

func (ArticleReview) TableName() string { return TableArticleReviews }

// ArticleSnapshot freezes content and generation inputs for publishing.
type ArticleSnapshot struct {
	ImmutableTenantModel
	ArticleID            uint64  `gorm:"column:article_id;not null;index"`
	ArticleVersionID     uint64  `gorm:"column:article_version_id;not null"`
	ArticleTypeVersionID *uint64 `gorm:"column:article_type_version_id"`
	PromptVersionID      *uint64 `gorm:"column:prompt_version_id"`
	WritingModelID       *uint64 `gorm:"column:writing_model_id"`
	Title                string  `gorm:"column:title;type:varchar(512);not null"`
	ContentMarkdown      string  `gorm:"column:content_markdown;type:longtext"`
	ContentHTML          string  `gorm:"column:content_html;type:longtext"`
	InputSnapshotJSON    []byte  `gorm:"column:input_snapshot_json;type:json"`
	KnowledgeRefsJSON    []byte  `gorm:"column:knowledge_refs_json;type:json"`
	GalleryRefsJSON      []byte  `gorm:"column:gallery_refs_json;type:json"`
	ContentHash          string  `gorm:"column:content_hash;type:char(64);not null;uniqueIndex"`
}

func (ArticleSnapshot) TableName() string { return TableArticleSnapshots }

// ArticleGenerationTask tracks a persisted LLM generation execution.
type ArticleGenerationTask struct {
	TenantModel
	ArticleID              *uint64    `gorm:"column:article_id;index"`
	ArticleTypeVersionID   uint64     `gorm:"column:article_type_version_id;not null"`
	PromptVersionID        *uint64    `gorm:"column:prompt_version_id"`
	WritingModelID         uint64     `gorm:"column:writing_model_id;not null"`
	WritingModelVersion    uint64     `gorm:"column:writing_model_version;not null"`
	ClientRequestID        string     `gorm:"column:client_request_id;type:varchar(128);not null;index"`
	Status                 string     `gorm:"column:status;type:varchar(32);not null;index"`
	InputJSON              []byte     `gorm:"column:input_json;type:json;not null"`
	PromptSnapshot         string     `gorm:"column:prompt_snapshot;type:longtext;not null"`
	ModelSnapshotJSON      []byte     `gorm:"column:model_snapshot_json;type:json;not null"`
	KnowledgeRefsJSON      []byte     `gorm:"column:knowledge_refs_json;type:json"`
	GalleryRefsJSON        []byte     `gorm:"column:gallery_refs_json;type:json"`
	OutputJSON             []byte     `gorm:"column:output_json;type:json"`
	InputTokens            uint64     `gorm:"column:input_tokens;not null;default:0"`
	OutputTokens           uint64     `gorm:"column:output_tokens;not null;default:0"`
	CostMicros             int64      `gorm:"column:cost_micros;not null;default:0"`
	ErrorCode              string     `gorm:"column:error_code;type:varchar(64)"`
	ErrorMessage           string     `gorm:"column:error_message;type:text"`
	AttemptCount           uint32     `gorm:"column:attempt_count;not null;default:0"`
	ResultArticleVersionID *uint64    `gorm:"column:result_article_version_id"`
	ResultSnapshotID       *uint64    `gorm:"column:result_snapshot_id"`
	StartedAt              *time.Time `gorm:"column:started_at"`
	CompletedAt            *time.Time `gorm:"column:completed_at"`
}

func (ArticleGenerationTask) TableName() string { return TableArticleGenerationTasks }

// ArticleImage links a generated article to an enterprise gallery image.
// Placement 1 is the article cover and placement 2 is an inline image.
type ArticleImage struct {
	TenantModel
	ArticleID      uint64 `gorm:"column:article_id;not null;index"`
	GalleryImageID uint64 `gorm:"column:gallery_image_id;not null;index"`
	Placement      int32  `gorm:"column:placement;type:tinyint unsigned;not null;default:2"`
	SortOrder      int32  `gorm:"column:sort_order;not null;default:0"`
}

func (ArticleImage) TableName() string { return TableArticleImages }

// Material stores reusable image or content assets by object key.
type Material struct {
	TenantModel
	Name         string `gorm:"column:name;type:varchar(255);not null"`
	MaterialType string `gorm:"column:material_type;type:varchar(32);not null;index"`
	ObjectKey    string `gorm:"column:object_key;type:varchar(1024);not null"`
	ContentHash  string `gorm:"column:content_hash;type:char(64);not null;index"`
	MimeType     string `gorm:"column:mime_type;type:varchar(128)"`
	TagsJSON     []byte `gorm:"column:tags_json;type:json"`
	MetadataJSON []byte `gorm:"column:metadata_json;type:json"`
}

func (Material) TableName() string { return TableMaterials }
