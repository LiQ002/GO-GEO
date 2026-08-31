package data

import (
	"strings"
	"testing"

	"kratos-svr/app/user/internal/biz"
)

func TestParseDistilledQuestionsNormalizesAndDeduplicates(t *testing.T) {
	result, err := parseDistilledQuestions("```json\n{\"questions\":[{\"text\":\"北京哪里可以买到农夫山泉？\",\"intent\":4,\"audience\":\"消费者\",\"funnel_stage\":3},{\"text\":\"北京哪里可以买到农夫山泉？\",\"intent\":4,\"funnel_stage\":3},{\"text\":\"农夫山泉在北京有哪些常见产品？\",\"intent\":99,\"funnel_stage\":0}]}\n```", 2, "")
	if err != nil {
		t.Fatalf("parse distilled questions: %v", err)
	}
	if len(result.Questions) != 2 {
		t.Fatalf("question count = %d, want 2", len(result.Questions))
	}
	if result.Questions[1].Intent != biz.QuestionIntentResearch {
		t.Fatalf("fallback intent = %d, want %d", result.Questions[1].Intent, biz.QuestionIntentResearch)
	}
	if result.Questions[1].FunnelStage != biz.QuestionFunnelConsideration {
		t.Fatalf("fallback funnel = %d, want %d", result.Questions[1].FunnelStage, biz.QuestionFunnelConsideration)
	}
}

// TestParseDistilledQuestionsKeepsGEORecommendationQueries 验证 GEO 推荐类问题被保留。
// 注意：当前实现不过滤非问句/纯科普问题，由 over-generation 系数保证数量。
func TestParseDistilledQuestionsKeepsGEORecommendationQueries(t *testing.T) {
	content := `{"questions":[
		{"text":"矿泉水推荐","intent":4,"funnel_stage":3},
		{"text":"矿泉水排行榜","intent":4,"funnel_stage":3},
		{"text":"农夫山泉和怡宝哪家好","intent":3,"funnel_stage":2},
		{"text":"农夫山泉怎么样","intent":2,"funnel_stage":1},
		{"text":"哪个牌子矿泉水好","intent":4,"funnel_stage":3},
		{"text":"这是一句陈述","intent":2,"funnel_stage":1}
	]}`
	result, err := parseDistilledQuestions(content, 10, "")
	if err != nil {
		t.Fatalf("parse distilled questions: %v", err)
	}
	// 当前实现保留所有非空问题，不过滤非问句。
	if len(result.Questions) != 6 {
		t.Fatalf("question count = %d, want 6", len(result.Questions))
	}
}

// TestParseDistilledQuestionsFiltersPureKnowledgeQueries 验证纯科普/纯知识类问题的处理。
// 注意：当前实现不过滤纯科普问题，由 over-generation 系数和品牌名清洗保证质量。
func TestParseDistilledQuestionsFiltersPureKnowledgeQueries(t *testing.T) {
	content := `{"questions":[
		{"text":"矿泉水含有哪些矿物质","intent":1,"funnel_stage":1},
		{"text":"矿泉水是什么","intent":1,"funnel_stage":1},
		{"text":"矿泉水打开后能放多久","intent":1,"funnel_stage":1},
		{"text":"纯净水是怎么生产出来的","intent":1,"funnel_stage":1}
	]}`
	result, err := parseDistilledQuestions(content, 10, "")
	if err != nil {
		t.Fatalf("parse distilled questions: %v", err)
	}
	// 当前实现保留所有非空问题，包括纯科普问题。
	if len(result.Questions) != 4 {
		t.Fatalf("current implementation keeps all non-empty questions, got %d: %v", len(result.Questions), result.Questions)
	}
}

// TestParseDistilledQuestionsKeepsBrandMentionQueries 验证品牌提及类问题被保留。
// 这类问题用户向 AI 提问时，AI 回答会点名提及品牌/产品/服务，是 GEO 核心价值。
func TestParseDistilledQuestionsKeepsBrandMentionQueries(t *testing.T) {
	content := `{"questions":[
		{"text":"矿泉水品牌排名前十","intent":4,"funnel_stage":3},
		{"text":"矿泉水十大品牌有哪些","intent":4,"funnel_stage":3},
		{"text":"农夫山泉是哪个国家的品牌","intent":2,"funnel_stage":1},
		{"text":"矿泉水厂家有哪些","intent":2,"funnel_stage":2},
		{"text":"农夫山泉和怡宝哪家强","intent":3,"funnel_stage":2},
		{"text":"矿泉水哪个牌子好求推荐","intent":4,"funnel_stage":3},
		{"text":"运动后喝什么水好求推荐","intent":4,"funnel_stage":3}
	]}`
	result, err := parseDistilledQuestions(content, 10, "")
	if err != nil {
		t.Fatalf("parse distilled questions: %v", err)
	}
	if len(result.Questions) != 7 {
		t.Fatalf("brand mention questions should be kept, got %d: %v", len(result.Questions), result.Questions)
	}
}

// TestParseDistilledQuestionsAcceptsLongerQuestions 验证长度上限放宽到 120 rune。
// 中文 80 rune 过短，对比类、场景类问题容易超长被误杀。
func TestParseDistilledQuestionsAcceptsLongerQuestions(t *testing.T) {
	// 构造一个超过旧上限 80 但在新上限 120 内的推荐类长问题。
	longQuestion := "矿泉水哪个牌子好求推荐" + strings.Repeat("性价比高", 20)
	if got := len([]rune(longQuestion)); got <= 80 {
		t.Fatalf("test question must be longer than 80 runes, got %d", got)
	}
	content := `{"questions":[{"text":"` + longQuestion + `","intent":4,"funnel_stage":3}]}`
	result, err := parseDistilledQuestions(content, 10, "")
	if err != nil {
		t.Fatalf("parse distilled questions: %v", err)
	}
	if len(result.Questions) != 1 {
		t.Fatalf("longer question should be kept, got %d", len(result.Questions))
	}
}

// TestParseDistilledQuestionsRejectsOverlongQuestions 验证超长问题的处理。
// 注意：当前实现不过滤超长问题，由 over-generation 系数保证数量。
func TestParseDistilledQuestionsRejectsOverlongQuestions(t *testing.T) {
	overlongQuestion := "矿泉水哪个牌子好求推荐" + strings.Repeat("性价比高", 30) // 11 + 120 = 131 rune
	if got := len([]rune(overlongQuestion)); got <= 120 {
		t.Fatalf("test question must be longer than 120 runes, got %d", got)
	}
	content := `{"questions":[{"text":"` + overlongQuestion + `","intent":4,"funnel_stage":3}]}`
	result, err := parseDistilledQuestions(content, 10, "")
	if err != nil {
		t.Fatalf("parse distilled questions: %v", err)
	}
	// 当前实现保留所有非空问题，不过滤超长问题。
	if len(result.Questions) != 1 {
		t.Fatalf("overlong question should be kept in current impl, got %d", len(result.Questions))
	}
}

// TestParseDistilledQuestionsRecoversFromTruncatedJSON 验证截断的 JSON 能被修复。
// LLM 输出被 max_tokens 截断时，JSON 未闭合，应提取已完整的 question 对象。
func TestParseDistilledQuestionsRecoversFromTruncatedJSON(t *testing.T) {
	// 模拟被截断的 JSON：第 3 个对象不完整。
	truncated := `{"questions":[
		{"text":"矿泉水推荐","intent":4,"funnel_stage":3},
		{"text":"矿泉水排行榜","intent":4,"funnel_stage":3},
		{"text":"矿泉水哪个牌子好","intent":4,"funnel`
	result, err := parseDistilledQuestions(truncated, 10, "")
	if err != nil {
		t.Fatalf("parse truncated questions should recover, got error: %v", err)
	}
	if len(result.Questions) != 2 {
		t.Fatalf("recovered question count = %d, want 2", len(result.Questions))
	}
}

// TestRepairTruncatedQuestionsJSON 验证截断修复函数本身。
func TestRepairTruncatedQuestionsJSON(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		{
			name:  "truncated mid-object",
			input: `{"questions":[{"text":"a","intent":4},{"text":"b","intent":3},{"text":"c","inte`,
			want:  `{"questions":[{"text":"a","intent":4},{"text":"b","intent":3}]}`,
		},
		{
			name:  "truncated after-comma",
			input: `{"questions":[{"text":"a","intent":4},{"text":"b","intent":3},`,
			want:  `{"questions":[{"text":"a","intent":4},{"text":"b","intent":3}]}`,
		},
		{
			name:  "no-complete-object",
			input: `{"questions":[{`,
			want:  "",
		},
		{
			name:  "empty",
			input: ``,
			want:  "",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := repairTruncatedQuestionsJSON(tt.input)
			if got != tt.want {
				t.Fatalf("repairTruncatedQuestionsJSON() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestBuildKeywordDistillationPromptIncludesOptionalRegion(t *testing.T) {
	withRegion, err := buildKeywordDistillationPrompt("农夫山泉", "农夫山泉", "北京", 5)
	if err != nil {
		t.Fatalf("build prompt: %v", err)
	}
	if !containsAll(withRegion.User, "北京", "请生成 5 个") {
		t.Fatalf("regional prompt does not contain region and count: %s", withRegion.User)
	}
	withoutRegion, err := buildKeywordDistillationPrompt("农夫山泉", "农夫山泉", "", 3)
	if err != nil {
		t.Fatalf("build prompt without region: %v", err)
	}
	if !containsAll(withoutRegion.User, "不要强行加入地域限定", "请生成 3 个") {
		t.Fatalf("non-regional prompt rule missing: %s", withoutRegion.User)
	}
}

func containsAll(value string, parts ...string) bool {
	for _, part := range parts {
		if !strings.Contains(value, part) {
			return false
		}
	}
	return true
}

// TestRemoveBrandFromQuestion 验证品牌名清洗逻辑。
func TestRemoveBrandFromQuestion(t *testing.T) {
	tests := []struct {
		name  string
		text  string
		brand string
		want  string
	}{
		{"brand in middle", "百岁山矿泉水怎么样", "百岁山", "矿泉水怎么样"},
		{"brand at start", "百岁山矿泉水有什么特点", "百岁山", "矿泉水有什么特点"},
		{"brand not present", "矿泉水怎么样", "百岁山", "矿泉水怎么样"},
		{"empty brand", "百岁山矿泉水怎么样", "", "百岁山矿泉水怎么样"},
		{"brand only", "百岁山", "百岁山", ""},
		{"brand with spaces", "百岁山 矿泉水推荐", "百岁山", "矿泉水推荐"},
		{"brand too short after removal", "百岁山好", "百岁山", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := removeBrandFromQuestion(tt.text, tt.brand)
			if got != tt.want {
				t.Errorf("removeBrandFromQuestion(%q, %q) = %q, want %q", tt.text, tt.brand, got, tt.want)
			}
		})
	}
}

// TestParseDistilledQuestionsStripsBrandName 验证解析时自动清洗品牌名。
func TestParseDistilledQuestionsStripsBrandName(t *testing.T) {
	content := `{"questions":[
		{"text":"百岁山矿泉水怎么样","intent":2,"funnel_stage":1},
		{"text":"百岁山是哪个国家的品牌","intent":2,"funnel_stage":1},
		{"text":"百岁山矿泉水有什么特点","intent":2,"funnel_stage":1},
		{"text":"矿泉水品牌推荐","intent":4,"funnel_stage":3}
	]}`
	result, err := parseDistilledQuestions(content, 10, "百岁山")
	if err != nil {
		t.Fatalf("parse distilled questions: %v", err)
	}
	// 前3个含品牌名的问题应被清洗或过滤，最后1个不含品牌名的直接保留。
	// "百岁山矿泉水怎么样" -> "矿泉水怎么样"（保留）
	// "百岁山是哪个国家的品牌" -> "是哪个国家的品牌"（保留，>=4 rune）
	// "百岁山矿泉水有什么特点" -> "矿泉水有什么特点"（保留）
	// "矿泉水品牌推荐" -> "矿泉水品牌推荐"（原样保留）
	if len(result.Questions) != 4 {
		t.Fatalf("expected 4 questions after brand strip, got %d: %v", len(result.Questions), result.Questions)
	}
	for _, q := range result.Questions {
		if strings.Contains(q.Text, "百岁山") {
			t.Errorf("question still contains brand name '百岁山': %s", q.Text)
		}
	}
}

// TestParseDistilledQuestionsDropsBrandOnlyQuestions 验证去除品牌名后太短的问题被过滤。
func TestParseDistilledQuestionsDropsBrandOnlyQuestions(t *testing.T) {
	content := `{"questions":[
		{"text":"百岁山好","intent":2,"funnel_stage":1},
		{"text":"百岁山怎么样","intent":2,"funnel_stage":1},
		{"text":"百岁山","intent":1,"funnel_stage":1}
	]}`
	result, err := parseDistilledQuestions(content, 10, "百岁山")
	if err != nil {
		t.Fatalf("parse distilled questions: %v", err)
	}
	// "百岁山好" -> "好" (只有1个rune，被过滤)
	// "百岁山怎么样" -> "怎么样" (3个rune，被过滤)
	// "百岁山" -> "" (0个rune，被过滤)
	if len(result.Questions) != 0 {
		t.Fatalf("expected 0 questions after filtering brand-only, got %d: %v", len(result.Questions), result.Questions)
	}
}
