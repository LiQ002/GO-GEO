package data

import (
	"errors"
	"strings"
	"testing"

	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/data/model"
)

func TestLoadKnowledgeContextUsesOnlySelectedEnterpriseKnowledge(t *testing.T) {
	t.Parallel()

	db := openKnowledgeTestDB(t)
	base := model.KnowledgeBase{
		TenantModel: model.TenantModel{EnterpriseID: 18},
		Name:        systemKnowledgeBaseName,
		Status:      biz.KnowledgeBaseStatusActive,
		Version:     1,
	}
	if err := db.Create(&base).Error; err != nil {
		t.Fatal(err)
	}
	document := model.KnowledgeDocument{
		TenantModel:     model.TenantModel{EnterpriseID: 18},
		KnowledgeBaseID: base.ID,
		Category:        biz.KnowledgeCategoryProductAdvantages,
		Title:           "核心能力",
		Content:         "部署速度快，并提供完整审计记录。",
		SourceType:      biz.KnowledgeSourceTypeText,
		ParseStatus:     biz.KnowledgeParseStatusParsed,
		DocumentVersion: 1,
	}
	if err := db.Create(&document).Error; err != nil {
		t.Fatal(err)
	}
	if err := createKnowledgeChunks(db, &document, document.Content); err != nil {
		t.Fatal(err)
	}

	repo := &articleGenerationRepo{data: &Data{db: db}}
	contextText, refs, err := repo.loadKnowledgeContext(db, 18, nil, []uint64{document.ID})
	if err != nil {
		t.Fatalf("loadKnowledgeContext() error = %v", err)
	}
	if !strings.Contains(contextText, "[分类:产品优势 资料:核心能力") || !strings.Contains(contextText, document.Content) {
		t.Fatalf("loadKnowledgeContext() context = %q", contextText)
	}
	if len(refs) != 1 || refs[0].Category != biz.KnowledgeCategoryProductAdvantages {
		t.Fatalf("loadKnowledgeContext() refs = %#v", refs)
	}

	emptyContext, emptyRefs, err := repo.loadKnowledgeContext(db, 18, nil, nil)
	if err != nil {
		t.Fatalf("loadKnowledgeContext() empty selection error = %v", err)
	}
	if emptyContext != "" || len(emptyRefs) != 0 {
		t.Fatalf("empty selection context = %q, refs = %#v", emptyContext, emptyRefs)
	}

	emptyBase := model.KnowledgeBase{
		TenantModel: model.TenantModel{EnterpriseID: 18},
		Name:        "空知识库",
		Status:      biz.KnowledgeBaseStatusActive,
		Version:     1,
	}
	if err := db.Create(&emptyBase).Error; err != nil {
		t.Fatal(err)
	}
	if _, _, err := repo.loadKnowledgeContext(db, 18, []uint64{emptyBase.ID}, nil); !errors.Is(err, biz.ErrArticleGenerationKnowledge) {
		t.Fatalf("empty knowledge base error = %v", err)
	}

	foreignDocument := model.KnowledgeDocument{
		TenantModel:     model.TenantModel{EnterpriseID: 19},
		KnowledgeBaseID: base.ID,
		Category:        biz.KnowledgeCategoryEnterpriseProfile,
		Title:           "其他企业知识",
		SourceType:      biz.KnowledgeSourceTypeText,
		ParseStatus:     biz.KnowledgeParseStatusParsed,
		DocumentVersion: 1,
	}
	if err := db.Create(&foreignDocument).Error; err != nil {
		t.Fatal(err)
	}
	if _, _, err := repo.loadKnowledgeContext(db, 18, nil, []uint64{foreignDocument.ID}); !errors.Is(err, biz.ErrArticleGenerationKnowledge) {
		t.Fatalf("foreign knowledge document error = %v", err)
	}
}
