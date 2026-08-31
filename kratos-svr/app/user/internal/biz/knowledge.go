package biz

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/go-kratos/kratos/v3/errors"
)

var (
	ErrKnowledgeBaseNotFound = errors.NotFound("KNOWLEDGE_BASE_NOT_FOUND", "knowledge base not found")
	ErrKnowledgeBaseInvalid  = errors.BadRequest("KNOWLEDGE_BASE_INVALID", "invalid knowledge base")
	ErrKnowledgeBaseConflict = errors.Conflict("KNOWLEDGE_BASE_CONFLICT", "knowledge base version conflict")
	ErrKnowledgeBaseNotEmpty = errors.Conflict("KNOWLEDGE_BASE_NOT_EMPTY", "knowledge base still contains documents")
	ErrKnowledgeDocNotFound  = errors.NotFound("KNOWLEDGE_DOCUMENT_NOT_FOUND", "knowledge document not found")
	ErrKnowledgeDocInvalid   = errors.BadRequest("KNOWLEDGE_DOCUMENT_INVALID", "invalid knowledge document")
	ErrKnowledgeDocConflict  = errors.Conflict("KNOWLEDGE_DOCUMENT_CONFLICT", "knowledge document version conflict")
)

type KnowledgeBase struct {
	ID           uint64
	EnterpriseID uint64
	Name         string
	Description  string
	Status       int32
	Version      uint64
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type KnowledgeBaseListOptions struct {
	Offset  int
	Limit   int
	Status  int32
	Keyword string
}

type KnowledgeDocument struct {
	ID              uint64
	EnterpriseID    uint64
	KnowledgeBaseID uint64
	Category        int32
	Title           string
	SourceType      int32
	SourceURL       string
	ObjectKey       string
	ContentHash     string
	MimeType        string
	ParseStatus     int32
	ParseError      string
	DocumentVersion uint32
	MetadataJSON    string
	Content         string
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type KnowledgeDocumentListOptions struct {
	Offset          int
	Limit           int
	KnowledgeBaseID uint64
	Category        int32
	SourceType      int32
	ParseStatus     int32
	Keyword         string
}

type KnowledgeChunk struct {
	ID                  uint64
	EnterpriseID        uint64
	KnowledgeDocumentID uint64
	DocumentVersion     uint32
	ChunkIndex          uint32
	Content             string
	ContentHash         string
	LocatorJSON         string
	MetadataJSON        string
	CreatedAt           time.Time
}

type KnowledgeChunkListOptions struct {
	Offset          int
	Limit           int
	DocumentVersion uint32
}

type KnowledgeRepo interface {
	CreateBase(context.Context, *KnowledgeBase) (*KnowledgeBase, error)
	GetBase(context.Context, uint64, uint64) (*KnowledgeBase, error)
	ListBases(context.Context, uint64, KnowledgeBaseListOptions) ([]*KnowledgeBase, int64, error)
	UpdateBase(context.Context, *KnowledgeBase) (*KnowledgeBase, error)
	DeleteBase(context.Context, uint64, uint64, uint64) error

	CreateDocument(context.Context, *KnowledgeDocument) (*KnowledgeDocument, error)
	GetDocument(context.Context, uint64, uint64) (*KnowledgeDocument, error)
	ListDocuments(context.Context, uint64, KnowledgeDocumentListOptions) ([]*KnowledgeDocument, int64, error)
	UpdateDocument(context.Context, *KnowledgeDocument) (*KnowledgeDocument, error)
	DeleteDocument(context.Context, uint64, uint64, uint32) error
	RetryDocumentParse(context.Context, uint64, uint64, uint32) (*KnowledgeDocument, error)
	ListChunks(context.Context, uint64, uint64, KnowledgeChunkListOptions) ([]*KnowledgeChunk, int64, error)
}

type KnowledgeUsecase struct {
	repo KnowledgeRepo
}

func NewKnowledgeUsecase(repo KnowledgeRepo) *KnowledgeUsecase {
	return &KnowledgeUsecase{repo: repo}
}

func (u *KnowledgeUsecase) CreateBase(ctx context.Context, base *KnowledgeBase) (*KnowledgeBase, error) {
	if err := validateKnowledgeBase(base, false); err != nil {
		return nil, err
	}
	if base.Status == 0 {
		base.Status = KnowledgeBaseStatusActive
	}
	return u.repo.CreateBase(ctx, base)
}

func (u *KnowledgeUsecase) GetBase(ctx context.Context, enterpriseID, id uint64) (*KnowledgeBase, error) {
	if enterpriseID == 0 || id == 0 {
		return nil, ErrKnowledgeBaseInvalid
	}
	return u.repo.GetBase(ctx, enterpriseID, id)
}

func (u *KnowledgeUsecase) ListBases(ctx context.Context, enterpriseID uint64, opts KnowledgeBaseListOptions) ([]*KnowledgeBase, int64, error) {
	if enterpriseID == 0 {
		return nil, 0, ErrKnowledgeBaseInvalid
	}
	return u.repo.ListBases(ctx, enterpriseID, opts)
}

func (u *KnowledgeUsecase) UpdateBase(ctx context.Context, base *KnowledgeBase) (*KnowledgeBase, error) {
	if err := validateKnowledgeBase(base, true); err != nil {
		return nil, err
	}
	return u.repo.UpdateBase(ctx, base)
}

func (u *KnowledgeUsecase) DeleteBase(ctx context.Context, enterpriseID, id, version uint64) error {
	if enterpriseID == 0 || id == 0 || version == 0 {
		return ErrKnowledgeBaseInvalid
	}
	return u.repo.DeleteBase(ctx, enterpriseID, id, version)
}

func (u *KnowledgeUsecase) CreateDocument(ctx context.Context, document *KnowledgeDocument) (*KnowledgeDocument, error) {
	if document != nil && document.Category == 0 {
		document.Category = KnowledgeCategoryEnterpriseProfile
	}
	if err := validateKnowledgeDocument(document, false); err != nil {
		return nil, err
	}
	return u.repo.CreateDocument(ctx, document)
}

func (u *KnowledgeUsecase) GetDocument(ctx context.Context, enterpriseID, id uint64) (*KnowledgeDocument, error) {
	if enterpriseID == 0 || id == 0 {
		return nil, ErrKnowledgeDocInvalid
	}
	return u.repo.GetDocument(ctx, enterpriseID, id)
}

func (u *KnowledgeUsecase) ListDocuments(ctx context.Context, enterpriseID uint64, opts KnowledgeDocumentListOptions) ([]*KnowledgeDocument, int64, error) {
	if enterpriseID == 0 {
		return nil, 0, ErrKnowledgeDocInvalid
	}
	return u.repo.ListDocuments(ctx, enterpriseID, opts)
}

func (u *KnowledgeUsecase) UpdateDocument(ctx context.Context, document *KnowledgeDocument) (*KnowledgeDocument, error) {
	if document != nil && document.Category == 0 {
		document.Category = KnowledgeCategoryEnterpriseProfile
	}
	if err := validateKnowledgeDocument(document, true); err != nil {
		return nil, err
	}
	return u.repo.UpdateDocument(ctx, document)
}

func (u *KnowledgeUsecase) DeleteDocument(ctx context.Context, enterpriseID, id uint64, version uint32) error {
	if enterpriseID == 0 || id == 0 || version == 0 {
		return ErrKnowledgeDocInvalid
	}
	return u.repo.DeleteDocument(ctx, enterpriseID, id, version)
}

func (u *KnowledgeUsecase) RetryDocumentParse(ctx context.Context, enterpriseID, id uint64, version uint32) (*KnowledgeDocument, error) {
	if enterpriseID == 0 || id == 0 || version == 0 {
		return nil, ErrKnowledgeDocInvalid
	}
	return u.repo.RetryDocumentParse(ctx, enterpriseID, id, version)
}

func (u *KnowledgeUsecase) ListChunks(ctx context.Context, enterpriseID, documentID uint64, opts KnowledgeChunkListOptions) ([]*KnowledgeChunk, int64, error) {
	if enterpriseID == 0 || documentID == 0 {
		return nil, 0, ErrKnowledgeDocInvalid
	}
	return u.repo.ListChunks(ctx, enterpriseID, documentID, opts)
}

func validateKnowledgeBase(base *KnowledgeBase, update bool) error {
	if base == nil || base.EnterpriseID == 0 || strings.TrimSpace(base.Name) == "" {
		return ErrKnowledgeBaseInvalid
	}
	if update && (base.ID == 0 || base.Version == 0) {
		return ErrKnowledgeBaseInvalid
	}
	if update && !validKnowledgeBaseStatus(base.Status) {
		return ErrKnowledgeBaseInvalid
	}
	if base.Status != 0 && !validKnowledgeBaseStatus(base.Status) {
		return ErrKnowledgeBaseInvalid
	}
	return nil
}

func validateKnowledgeDocument(document *KnowledgeDocument, update bool) error {
	if document == nil || document.EnterpriseID == 0 || strings.TrimSpace(document.Title) == "" {
		return ErrKnowledgeDocInvalid
	}
	if update && (document.ID == 0 || document.DocumentVersion == 0) {
		return ErrKnowledgeDocInvalid
	}
	if document.MetadataJSON != "" && !json.Valid([]byte(document.MetadataJSON)) {
		return ErrKnowledgeDocInvalid
	}
	if !validKnowledgeSourceType(document.SourceType) {
		return ErrKnowledgeDocInvalid
	}
	if !validKnowledgeCategory(document.Category) {
		return ErrKnowledgeDocInvalid
	}
	switch document.SourceType {
	case KnowledgeSourceTypeText:
		if !update && strings.TrimSpace(document.Content) == "" {
			return ErrKnowledgeDocInvalid
		}
	case KnowledgeSourceTypeURL:
		if strings.TrimSpace(document.SourceURL) == "" {
			return ErrKnowledgeDocInvalid
		}
	case KnowledgeSourceTypeFile:
		if strings.TrimSpace(document.ObjectKey) == "" {
			return ErrKnowledgeDocInvalid
		}
	}
	return nil
}
