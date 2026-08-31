package data

import (
	"testing"

	"kratos-svr/app/admin/internal/biz"
)

func TestFirstDiagnosisMentionPosition(t *testing.T) {
	t.Parallel()

	content := "建议先比较竞品，然后了解星河科技的服务。"
	if got := firstDiagnosisMentionPosition(content, []string{"星河科技", "星河"}); got != 13 {
		t.Fatalf("firstDiagnosisMentionPosition() = %d, want 13", got)
	}
	if got := firstDiagnosisMentionPosition(content, []string{"不存在"}); got != 0 {
		t.Fatalf("firstDiagnosisMentionPosition() missing = %d, want 0", got)
	}
}

func TestDiagnosisCostMicros(t *testing.T) {
	t.Parallel()

	model := &biz.SalesDiagnosisModel{
		InputPriceMicrosPerMillionTokens:  2_000_000,
		OutputPriceMicrosPerMillionTokens: 8_000_000,
	}
	if got := diagnosisCostMicros(model, 1_000, 500); got != 6_000 {
		t.Fatalf("diagnosisCostMicros() = %d, want 6000", got)
	}
}

func TestDiagnosisMentionCountDeduplicatesAliases(t *testing.T) {
	t.Parallel()

	if got := diagnosisMentionCount("星河和星河科技都被提及，星河再次出现", []string{"星河", "星河科技", "星河"}); got != 3 {
		t.Fatalf("diagnosisMentionCount() = %d, want 3", got)
	}
}

func TestDiagnosisProviderCitationsOnlyReadsStructuredExtra(t *testing.T) {
	t.Parallel()

	extra := map[string]any{
		"request_id": "req-123",
		"citations": []any{
			map[string]any{"id": "src-1", "title": "官方资料", "url": "https://example.com/a", "snippet": "摘要"},
			map[string]any{"url": "javascript:alert(1)"},
			map[string]any{"url": "https://example.com/a"},
		},
	}
	if got := diagnosisProviderRequestID(extra); got != "req-123" {
		t.Fatalf("diagnosisProviderRequestID() = %q", got)
	}
	citations := diagnosisProviderCitations(extra)
	if len(citations) != 1 || citations[0].Domain != "example.com" || citations[0].ProviderSourceID != "src-1" {
		t.Fatalf("diagnosisProviderCitations() = %#v", citations)
	}
}

func TestVerifiedDiagnosisEvidenceRejectsInventedExcerpt(t *testing.T) {
	t.Parallel()

	if got := verifiedDiagnosisEvidence("回答中只有真实证据", "不存在的证据"); got != "" {
		t.Fatalf("verifiedDiagnosisEvidence() = %q", got)
	}
	if got := verifiedDiagnosisEvidence("回答中只有真实证据", "真实证据"); got != "真实证据" {
		t.Fatalf("verifiedDiagnosisEvidence() = %q", got)
	}
}

func TestClassifyDiagnosisCitationOwnershipUsesFrozenDomains(t *testing.T) {
	t.Parallel()

	citations := []*biz.SalesDiagnosisCitation{
		{Domain: "www.target.example", OwnershipType: 1},
		{Domain: "rival.example", OwnershipType: 1},
		{Domain: "media.example", OwnershipType: 1},
	}
	classifyDiagnosisCitationOwnership(citations, &biz.SalesDiagnosisProfile{
		Website:     "https://target.example/about",
		Competitors: []*biz.SalesDiagnosisProfileCompetitor{{Website: "https://www.rival.example"}},
	})
	if citations[0].OwnershipType != 2 || citations[1].OwnershipType != 3 || citations[2].OwnershipType != 1 {
		t.Fatalf("citation ownership = %d/%d/%d", citations[0].OwnershipType, citations[1].OwnershipType, citations[2].OwnershipType)
	}
}

func TestClassifyDiagnosisCitationSourcesUsesCustomerFacingTypes(t *testing.T) {
	t.Parallel()

	citations := []*biz.SalesDiagnosisCitation{
		{Domain: "target.example", Title: "品牌官网"},
		{Domain: "rival.example", OwnershipType: 3, Title: "竞品官网"},
		{Domain: "baike.example", Title: "品牌百科"},
		{Domain: "media.example", SourceName: "行业协会"},
		{Domain: "community.example", SourceName: "用户社区"},
	}
	classifyDiagnosisCitationSources(citations, &biz.SalesDiagnosisProfile{
		Website: "https://target.example",
	})

	want := []int32{
		biz.SalesDiagnosisSourceOfficial,
		biz.SalesDiagnosisSourceOfficial,
		biz.SalesDiagnosisSourceEncyclopedia,
		biz.SalesDiagnosisSourceIndustryMedia,
		biz.SalesDiagnosisSourceCommunityUGC,
	}
	for index, citation := range citations {
		if citation.SourceType != want[index] {
			t.Fatalf("citation[%d].SourceType = %d, want %d", index, citation.SourceType, want[index])
		}
	}
}

func TestNormalizeDiagnosisPreparationQuestionsRejectsUnrelatedPrompts(t *testing.T) {
	t.Parallel()

	values := []struct {
		Question string `json:"question"`
		Intent   string `json:"intent"`
		Reason   string `json:"reason"`
	}{
		{Question: "星河云在企业云服务中是否会被推荐？", Intent: "品类推荐"},
		{Question: "请推荐值得关注的品牌", Intent: "泛化推荐"},
		{Question: "星河云在企业云服务中是否会被推荐？", Intent: "重复"},
	}
	items := normalizeDiagnosisPreparationQuestions("星河云", values)
	if len(items) != 1 || items[0].Intent != "品类推荐" {
		t.Fatalf("normalizeDiagnosisPreparationQuestions() = %#v", items)
	}
}

func TestDiagnosisTargetNamesIncludesPreparedAliasesOnly(t *testing.T) {
	t.Parallel()

	got := diagnosisTargetNames(
		&biz.SalesDiagnosisProfile{BrandName: "星河云", BrandAliases: []string{"星河"}},
		[]*biz.SalesDiagnosisBrandTerm{
			{Term: "Xinghe Cloud", TermType: biz.SalesDiagnosisBrandTermTypeAlias},
			{Term: "竞争品牌", TermType: biz.SalesDiagnosisBrandTermTypeCompetitor},
		},
	)
	if len(got) != 3 || got[2] != "Xinghe Cloud" {
		t.Fatalf("diagnosisTargetNames() = %#v", got)
	}
}
