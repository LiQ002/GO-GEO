package biz

import (
	"context"
	"errors"
	"testing"
)

func TestKnowledgeUsecaseCreateBaseDefaultsStatus(t *testing.T) {
	t.Parallel()

	repo := &knowledgeRepoStub{
		createBase: func(_ context.Context, base *KnowledgeBase) (*KnowledgeBase, error) {
			if base.Status != KnowledgeBaseStatusActive {
				t.Fatalf("status = %d, want %d", base.Status, KnowledgeBaseStatusActive)
			}
			base.ID = 11
			return base, nil
		},
	}
	usecase := NewKnowledgeUsecase(repo)
	created, err := usecase.CreateBase(context.Background(), &KnowledgeBase{EnterpriseID: 7, Name: "产品资料"})
	if err != nil {
		t.Fatalf("CreateBase() error = %v", err)
	}
	if created.ID != 11 {
		t.Fatalf("CreateBase() id = %d, want 11", created.ID)
	}
}

func TestKnowledgeUsecaseRejectsInvalidDocumentSources(t *testing.T) {
	t.Parallel()

	usecase := NewKnowledgeUsecase(&knowledgeRepoStub{})
	tests := []struct {
		name     string
		document *KnowledgeDocument
	}{
		{name: "text without content", document: &KnowledgeDocument{EnterpriseID: 1, KnowledgeBaseID: 2, Title: "manual", SourceType: KnowledgeSourceTypeText}},
		{name: "url without source url", document: &KnowledgeDocument{EnterpriseID: 1, KnowledgeBaseID: 2, Title: "site", SourceType: KnowledgeSourceTypeURL}},
		{name: "file without object key", document: &KnowledgeDocument{EnterpriseID: 1, KnowledgeBaseID: 2, Title: "file", SourceType: KnowledgeSourceTypeFile}},
		{name: "unsupported source", document: &KnowledgeDocument{EnterpriseID: 1, KnowledgeBaseID: 2, Title: "other", SourceType: 99}},
		{name: "unsupported category", document: &KnowledgeDocument{EnterpriseID: 1, Title: "other", Category: 99, SourceType: KnowledgeSourceTypeText, Content: "content"}},
		{name: "invalid metadata", document: &KnowledgeDocument{EnterpriseID: 1, KnowledgeBaseID: 2, Title: "manual", SourceType: KnowledgeSourceTypeText, Content: "content", MetadataJSON: "{"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			_, err := usecase.CreateDocument(context.Background(), tt.document)
			if !errors.Is(err, ErrKnowledgeDocInvalid) {
				t.Fatalf("CreateDocument() error = %v, want %v", err, ErrKnowledgeDocInvalid)
			}
		})
	}
}

func TestKnowledgeUsecaseCreatesDirectContentWithoutBase(t *testing.T) {
	t.Parallel()

	repo := &knowledgeRepoStub{
		createDocument: func(_ context.Context, document *KnowledgeDocument) (*KnowledgeDocument, error) {
			if document.KnowledgeBaseID != 0 {
				t.Fatalf("knowledge base id = %d, want automatic resolution", document.KnowledgeBaseID)
			}
			if document.Category != KnowledgeCategoryEnterpriseProfile {
				t.Fatalf("category = %d, want %d", document.Category, KnowledgeCategoryEnterpriseProfile)
			}
			document.ID = 12
			return document, nil
		},
	}
	usecase := NewKnowledgeUsecase(repo)
	created, err := usecase.CreateDocument(context.Background(), &KnowledgeDocument{
		EnterpriseID: 3,
		Title:        "公司简介",
		SourceType:   KnowledgeSourceTypeText,
		Content:      "我们为企业提供 GEO 内容服务。",
	})
	if err != nil {
		t.Fatalf("CreateDocument() error = %v", err)
	}
	if created.ID != 12 {
		t.Fatalf("CreateDocument() id = %d, want 12", created.ID)
	}
}

func TestKnowledgeCategoryLabel(t *testing.T) {
	t.Parallel()

	if got := KnowledgeCategoryLabel(KnowledgeCategoryCompliance); got != "合规边界" {
		t.Fatalf("KnowledgeCategoryLabel() = %q, want 合规边界", got)
	}
	if got := KnowledgeCategoryLabel(0); got != "企业介绍" {
		t.Fatalf("KnowledgeCategoryLabel(0) = %q, want 企业介绍", got)
	}
}

type knowledgeRepoStub struct {
	createBase     func(context.Context, *KnowledgeBase) (*KnowledgeBase, error)
	createDocument func(context.Context, *KnowledgeDocument) (*KnowledgeDocument, error)
}

func (s *knowledgeRepoStub) CreateBase(ctx context.Context, base *KnowledgeBase) (*KnowledgeBase, error) {
	if s.createBase == nil {
		return nil, errors.New("unexpected CreateBase call")
	}
	return s.createBase(ctx, base)
}

func (*knowledgeRepoStub) GetBase(context.Context, uint64, uint64) (*KnowledgeBase, error) {
	return nil, errors.New("unexpected GetBase call")
}

func (*knowledgeRepoStub) ListBases(context.Context, uint64, KnowledgeBaseListOptions) ([]*KnowledgeBase, int64, error) {
	return nil, 0, errors.New("unexpected ListBases call")
}

func (*knowledgeRepoStub) UpdateBase(context.Context, *KnowledgeBase) (*KnowledgeBase, error) {
	return nil, errors.New("unexpected UpdateBase call")
}

func (*knowledgeRepoStub) DeleteBase(context.Context, uint64, uint64, uint64) error {
	return errors.New("unexpected DeleteBase call")
}

func (s *knowledgeRepoStub) CreateDocument(ctx context.Context, document *KnowledgeDocument) (*KnowledgeDocument, error) {
	if s.createDocument == nil {
		return nil, errors.New("unexpected CreateDocument call")
	}
	return s.createDocument(ctx, document)
}

func (*knowledgeRepoStub) GetDocument(context.Context, uint64, uint64) (*KnowledgeDocument, error) {
	return nil, errors.New("unexpected GetDocument call")
}

func (*knowledgeRepoStub) ListDocuments(context.Context, uint64, KnowledgeDocumentListOptions) ([]*KnowledgeDocument, int64, error) {
	return nil, 0, errors.New("unexpected ListDocuments call")
}

func (*knowledgeRepoStub) UpdateDocument(context.Context, *KnowledgeDocument) (*KnowledgeDocument, error) {
	return nil, errors.New("unexpected UpdateDocument call")
}

func (*knowledgeRepoStub) DeleteDocument(context.Context, uint64, uint64, uint32) error {
	return errors.New("unexpected DeleteDocument call")
}

func (*knowledgeRepoStub) RetryDocumentParse(context.Context, uint64, uint64, uint32) (*KnowledgeDocument, error) {
	return nil, errors.New("unexpected RetryDocumentParse call")
}

func (*knowledgeRepoStub) ListChunks(context.Context, uint64, uint64, KnowledgeChunkListOptions) ([]*KnowledgeChunk, int64, error) {
	return nil, 0, errors.New("unexpected ListChunks call")
}
