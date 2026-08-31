package data

import (
	"context"
	"strings"
	"testing"

	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/data/model"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestSplitKnowledgeContentPreservesOverlap(t *testing.T) {
	t.Parallel()

	content := strings.Repeat("知", knowledgeChunkSize+500)
	parts := splitKnowledgeContent(content)
	if len(parts) != 2 {
		t.Fatalf("len(parts) = %d, want 2", len(parts))
	}
	if len([]rune(parts[0])) != knowledgeChunkSize {
		t.Fatalf("first chunk length = %d, want %d", len([]rune(parts[0])), knowledgeChunkSize)
	}
	wantSecondLength := 500 + knowledgeChunkOverlap
	if len([]rune(parts[1])) != wantSecondLength {
		t.Fatalf("second chunk length = %d, want %d", len([]rune(parts[1])), wantSecondLength)
	}
	if parts[0][len(parts[0])-knowledgeChunkOverlap*len("知"):] != parts[1][:knowledgeChunkOverlap*len("知")] {
		t.Fatal("chunks do not contain the expected overlap")
	}
}

func TestContentHashIsStable(t *testing.T) {
	t.Parallel()

	first := contentHash("企业知识")
	second := contentHash("企业知识")
	if first != second || len(first) != 64 {
		t.Fatalf("contentHash() returned unstable SHA-256 values %q and %q", first, second)
	}
}

func TestJoinKnowledgeChunksRemovesGeneratedOverlap(t *testing.T) {
	t.Parallel()

	content := strings.Repeat("知识内容", 700)
	parts := splitKnowledgeContent(content)
	if got := joinKnowledgeChunks(parts); got != content {
		t.Fatalf("joinKnowledgeChunks() did not reconstruct the original content")
	}
}

func TestCreateKnowledgeContentAutomaticallyUsesSystemBase(t *testing.T) {
	t.Parallel()

	db := openKnowledgeTestDB(t)
	repo := &knowledgeRepo{data: &Data{db: db}}
	for _, title := range []string{"企业介绍", "产品优势"} {
		created, err := repo.CreateDocument(context.Background(), &biz.KnowledgeDocument{
			EnterpriseID: 9,
			Category:     biz.KnowledgeCategoryProductAdvantages,
			Title:        title,
			SourceType:   biz.KnowledgeSourceTypeText,
			Content:      "可验证的企业知识内容",
		})
		if err != nil {
			t.Fatalf("CreateDocument() error = %v", err)
		}
		if created.KnowledgeBaseID == 0 {
			t.Fatal("CreateDocument() did not resolve the system knowledge base")
		}
		if created.Content != "可验证的企业知识内容" {
			t.Fatalf("CreateDocument() content = %q", created.Content)
		}
	}

	var baseCount int64
	if err := db.Model(&model.KnowledgeBase{}).Where("enterprise_id = ?", 9).Count(&baseCount).Error; err != nil {
		t.Fatal(err)
	}
	if baseCount != 1 {
		t.Fatalf("system base count = %d, want 1", baseCount)
	}
	var chunkCount int64
	if err := db.Model(&model.KnowledgeChunk{}).Where("enterprise_id = ?", 9).Count(&chunkCount).Error; err != nil {
		t.Fatal(err)
	}
	if chunkCount != 2 {
		t.Fatalf("chunk count = %d, want 2", chunkCount)
	}
}

func TestListKnowledgeDocumentsHydratesLegacyContent(t *testing.T) {
	t.Parallel()

	db := openKnowledgeTestDB(t)
	base := model.KnowledgeBase{
		TenantModel: model.TenantModel{EnterpriseID: 10},
		Name:        "旧知识库",
		Status:      biz.KnowledgeBaseStatusActive,
		Version:     1,
	}
	if err := db.Create(&base).Error; err != nil {
		t.Fatal(err)
	}
	document := model.KnowledgeDocument{
		TenantModel:     model.TenantModel{EnterpriseID: 10},
		KnowledgeBaseID: base.ID,
		Category:        biz.KnowledgeCategoryEnterpriseProfile,
		Title:           "历史企业介绍",
		SourceType:      biz.KnowledgeSourceTypeText,
		ParseStatus:     biz.KnowledgeParseStatusParsed,
		DocumentVersion: 1,
	}
	if err := db.Create(&document).Error; err != nil {
		t.Fatal(err)
	}
	want := strings.Repeat("历史知识内容", 500)
	if err := createKnowledgeChunks(db, &document, want); err != nil {
		t.Fatal(err)
	}

	repo := &knowledgeRepo{data: &Data{db: db}}
	items, _, err := repo.ListDocuments(context.Background(), 10, biz.KnowledgeDocumentListOptions{Limit: 20})
	if err != nil {
		t.Fatalf("ListDocuments() error = %v", err)
	}
	if len(items) != 1 || items[0].Content != want {
		t.Fatalf("ListDocuments() did not hydrate legacy content")
	}
}

func openKnowledgeTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite database: %v", err)
	}
	if err := db.AutoMigrate(&model.KnowledgeBase{}, &model.KnowledgeDocument{}, &model.KnowledgeChunk{}); err != nil {
		t.Fatalf("migrate knowledge tables: %v", err)
	}
	return db
}
