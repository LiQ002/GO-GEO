package data

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/data/model"

	modelopenai "github.com/cloudwego/eino-ext/components/model/openai"
	"github.com/cloudwego/eino/schema"
	"gorm.io/gorm"
)

type einoKeywordQuestionDistiller struct {
	data *Data
}

func NewEinoKeywordQuestionDistiller(data *Data) biz.KeywordQuestionDistiller {
	return &einoKeywordQuestionDistiller{data: data}
}

func (d *einoKeywordQuestionDistiller) Generate(ctx context.Context, task *biz.KeywordDistillationTask) (*biz.KeywordDistillationResult, error) {
	if task == nil || task.WritingModelID == 0 || task.RequestedCount == 0 {
		return nil, biz.ErrKeywordDistillationInvalid
	}
	var credential model.WritingModelCredential
	if err := d.data.DB(ctx).Where("writing_model_id = ?", task.WritingModelID).First(&credential).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, biz.ErrKeywordDistillationModel
		}
		return nil, err
	}
	apiKey, err := d.data.openCredential(credential.Nonce, credential.Ciphertext, []byte(fmt.Sprintf("writing-model:%d", task.WritingModelID)))
	if err != nil {
		return nil, err
	}
	defer clear(apiKey)

	var modelSnapshot generationModelSnapshot
	if err := json.Unmarshal([]byte(task.ModelSnapshotJSON), &modelSnapshot); err != nil {
		return nil, fmt.Errorf("decode model snapshot: %w", err)
	}
	var promptSnapshot generationPromptSnapshot
	if err := json.Unmarshal([]byte(task.PromptSnapshot), &promptSnapshot); err != nil {
		return nil, fmt.Errorf("decode prompt snapshot: %w", err)
	}
	return distillQuestionsWithEino(ctx, modelSnapshot, promptSnapshot, task.RequestedCount, string(apiKey))
}

func distillQuestionsWithEino(ctx context.Context, modelSnapshot generationModelSnapshot, promptSnapshot generationPromptSnapshot, requestedCount uint32, apiKey string) (*biz.KeywordDistillationResult, error) {
	if modelSnapshot.Protocol != "openai_compatible" {
		return nil, fmt.Errorf("unsupported writing model protocol %q", modelSnapshot.Protocol)
	}
	if strings.TrimSpace(modelSnapshot.BaseURL) == "" || strings.TrimSpace(modelSnapshot.ModelID) == "" || strings.TrimSpace(apiKey) == "" {
		return nil, errors.New("writing model connection configuration is incomplete")
	}
	if modelSnapshot.MaxTokens == 0 || modelSnapshot.MaxTokens > 65536 || modelSnapshot.TimeoutSeconds == 0 || modelSnapshot.TimeoutSeconds > 600 {
		return nil, errors.New("writing model parameters are outside allowed limits")
	}
	if modelSnapshot.Temperature < 0 || modelSnapshot.Temperature > 2 || modelSnapshot.TopP < 0 || modelSnapshot.TopP > 1 {
		return nil, errors.New("writing model sampling parameters are outside allowed limits")
	}
	timeout := time.Duration(modelSnapshot.TimeoutSeconds) * time.Second
	temperature := float32(modelSnapshot.Temperature)
	topP := float32(modelSnapshot.TopP)
	maxTokens := int(modelSnapshot.MaxTokens)
	chatModel, err := modelopenai.NewChatModel(ctx, &modelopenai.ChatModelConfig{
		APIKey: apiKey, Timeout: timeout, BaseURL: strings.TrimRight(modelSnapshot.BaseURL, "/"), Model: modelSnapshot.ModelID,
		Temperature: &temperature, TopP: &topP, MaxTokens: &maxTokens,
	})
	if err != nil {
		return nil, fmt.Errorf("create Eino chat model: %w", err)
	}

	// over-generation：请求量按系数超额生成，给本地过滤留余量。
	requestAmount := uint32(math.Ceil(float64(requestedCount) * keywordDistillationOverGenerationFactor))
	if requestAmount < requestedCount {
		requestAmount = requestedCount
	}

	// 回填循环：首轮产出过滤后不足 requestedCount 时，用"还差 X 条"再调一轮，最多 keywordDistillationMaxRounds 轮。
	// 空内容或解析失败时降级请求量重试，避免因单轮异常直接失败。
	var (
		merged       []biz.DistilledQuestion
		seen         = make(map[string]struct{}, requestAmount)
		rawContents  []string
		inputTokens  uint64
		outputTokens uint64
		emptyRounds  int
	)
	remaining := requestedCount
	for round := 1; round <= keywordDistillationMaxRounds; round++ {
		if remaining == 0 {
			break
		}
		// 第 2 轮起用更小的请求量，避免 LLM 重复产出已生成的问题。
		// 空内容轮次后请求量减半，降低输出压力（可能是 max_tokens 不足导致 LLM 返回空）。
		roundRequest := requestAmount
		if round > 1 {
			roundRequest = uint32(math.Ceil(float64(remaining) * keywordDistillationOverGenerationFactor))
		}
		if emptyRounds > 0 {
			roundRequest = uint32(math.Ceil(float64(roundRequest) / float64(emptyRounds+1)))
			if roundRequest < 5 {
				roundRequest = 5
			}
		}
		system, userMsg := buildDistillationRoundPrompt(promptSnapshot, uint32(round), roundRequest, merged)
		response, err := chatModel.Generate(ctx, []*schema.Message{schema.SystemMessage(system), schema.UserMessage(userMsg)})
		if err != nil {
			return nil, fmt.Errorf("distill keyword questions with Eino (round %d): %w", round, err)
		}
		// 兼容思考型模型（DeepSeek-R1 / QwQ / Kimi K1.5 / Doubao-1.5-thinking 等）：
		// 这些模型把真正的回答放在 ReasoningContent，Content 可能是空字符串。
		// Content 为空时回退到 ReasoningContent，避免误判为"empty content"。
		content := strings.TrimSpace(response.Content)
		reasoningLen := len(strings.TrimSpace(response.ReasoningContent))
		if content == "" && reasoningLen > 0 {
			content = strings.TrimSpace(response.ReasoningContent)
			slog.Info("keyword distillation: content empty, fallback to reasoning_content",
				slog.Int("reasoning_len", reasoningLen),
				slog.String("model", modelSnapshot.ModelID),
			)
		}
		contentLen := len(content)
		finishReason := ""
		if response.ResponseMeta != nil {
			finishReason = response.ResponseMeta.FinishReason
		}
		slog.Info("keyword distillation model response",
			slog.String("model", modelSnapshot.ModelID),
			slog.String("base_url", modelSnapshot.BaseURL),
			slog.Int("content_len", contentLen),
			slog.Int("reasoning_len", reasoningLen),
			slog.String("finish_reason", finishReason),
			slog.Uint64("requested_count", uint64(requestedCount)),
			slog.Int("round", round),
			slog.Uint64("round_request", uint64(roundRequest)),
			slog.Int("max_tokens", maxTokens),
		)
		if response.ResponseMeta != nil && response.ResponseMeta.Usage != nil {
			inputTokens += uint64(max(response.ResponseMeta.Usage.PromptTokens, 0))
			outputTokens += uint64(max(response.ResponseMeta.Usage.CompletionTokens, 0))
		}
		// 空内容：可能是 max_tokens 不足或 LLM 异常，记 warning 并降级重试。
		if contentLen == 0 {
			emptyRounds++
			slog.Warn("keyword distillation empty response, will retry with smaller request",
				slog.Int("round", round),
				slog.Int("empty_rounds", emptyRounds),
				slog.Int("max_tokens", maxTokens),
				slog.String("finish_reason", finishReason),
				slog.Uint64("output_tokens", outputTokens),
				slog.Int("reasoning_len", reasoningLen),
			)
			continue
		}
		rawContents = append(rawContents, content)
		roundAdded, err := parseDistilledQuestionsWithSeen(content, requestedCount, seen, &merged, promptSnapshot.Brand)
		if err != nil {
			// 解析失败（修复后仍失败）：记 warning 并继续下一轮，不直接失败。
			slog.Warn("keyword distillation parse failed, will retry",
				slog.Int("round", round),
				slog.String("error", err.Error()),
			)
			continue
		}
		slog.Info("keyword distillation round summary",
			slog.Int("round", round),
			slog.Int("added", roundAdded),
			slog.Int("merged", len(merged)),
		)
		remaining = requestedCount - uint32(len(merged))
		if remaining == 0 {
			break
		}
	}

	// 截断到 requestedCount（防止 over-generation 多余）。
	if uint32(len(merged)) > requestedCount {
		merged = merged[:requestedCount]
	}
	if len(merged) == 0 {
		// 所有轮次都未产出可用问题，给出明确错误提示。
		if emptyRounds == keywordDistillationMaxRounds {
			return nil, fmt.Errorf("writing model returned empty content for %d rounds (requested %d), please check max_tokens config (current=%d, recommend >=4096)",
				emptyRounds, requestedCount, maxTokens)
		}
		return nil, fmt.Errorf("writing model returned no usable questions after %d rounds (requested %d, max_tokens=%d)",
			keywordDistillationMaxRounds, requestedCount, maxTokens)
	}
	result := &biz.KeywordDistillationResult{
		Questions:    merged,
		RawContent:   strings.Join(rawContents, "\n---\n"),
		InputTokens:  inputTokens,
		OutputTokens: outputTokens,
	}
	result.CostMicros = generationCostMicros(
		modelSnapshot.InputPriceMicrosPerMillionTokens,
		modelSnapshot.OutputPriceMicrosPerMillionTokens,
		result.InputTokens,
		result.OutputTokens,
	)
	return result, nil
}

// buildDistillationRoundPrompt 构造每轮的 prompt。
// 第 1 轮用原始 prompt（请求量已按 over-generation 系数放大）。
// 第 2+ 轮为回填补足：明确告诉 LLM"还差 X 条"并列出已生成的问题，避免重复。
// 回填轮换角度引导：不同用户群体、不同场景、不同价格区间、不同使用阶段，
// 让 LLM 产出与已有问题差异化的新问题，降低重复率。
func buildDistillationRoundPrompt(base generationPromptSnapshot, round, requestAmount uint32, existing []biz.DistilledQuestion) (system, user string) {
	if round == 1 {
		return base.System, base.User
	}
	// 回填轮的换角度引导，按轮次轮换不同视角。
	angles := []string{
		"请从不同用户群体（如 beginners/专业用户/企业采购/个人消费者）的视角补充问题",
		"请从不同价格区间和性价比角度补充问题（如低价位/中端/高端/性价比之王）",
		"请从不同使用场景和行业应用角度补充问题（如工业/户外/军工/化工/煤矿等场景）",
		"请从品牌对比和排行角度补充问题（如国产品牌/进口品牌/十大品牌/品牌差异）",
		"请从用户决策路径角度补充问题（如选购指南/避坑/评测/真实体验/口碑）",
	}
	angle := angles[(int(round)-2)%len(angles)]

	system = base.System + fmt.Sprintf("\n\n这是第 %d 轮回填补足。前面已生成 %d 条问题但数量不足，请只补充 %d 条全新的问题。"+
		"严格要求：不要与已生成问题重复或近似（改写也算重复）。%s。"+
		"\n【再次强调】生成的问题文本中严禁包含品牌名，品牌名只能作为内部参考！", round, len(existing), requestAmount, angle)

	// 列出已生成问题，避免 LLM 重复产出。
	var sb strings.Builder
	sb.WriteString("已生成的问题（请勿重复，也不要改写后重复）：\n")
	for i, q := range existing {
		if i >= 50 {
			sb.WriteString("（其余略）\n")
			break
		}
		sb.WriteString(fmt.Sprintf("%d. %s\n", i+1, q.Text))
	}
	user = fmt.Sprintf("%s\n\n%s\n请只补充 %d 条全新的、与上面完全不同的问题。%s。", base.User, sb.String(), requestAmount, angle)
	return system, user
}

// parseDistilledQuestionsWithSeen 解析 LLM 产出，过滤后追加到 merged（用 seen 去重）。
// brand 用于清洗问题中可能包含的品牌名（LLM 违规时自动修正）。
// 返回本轮新增的有效问题数。
func parseDistilledQuestionsWithSeen(content string, requestedCount uint32, seen map[string]struct{}, merged *[]biz.DistilledQuestion, brand string) (int, error) {
	raw := strings.TrimSpace(content)
	if raw == "" {
		return 0, fmt.Errorf("writing model returned empty question content (requested %d)", requestedCount)
	}
	var payload struct {
		Questions []biz.DistilledQuestion `json:"questions"`
	}
	cleaned := stripJSONFence(raw)
	if err := json.Unmarshal([]byte(cleaned), &payload); err != nil {
		repaired := repairTruncatedQuestionsJSON(cleaned)
		if repaired == "" {
			slog.Warn("keyword distillation parse failed (no repairable JSON found)",
				slog.Int("raw_len", len(raw)),
				slog.Int("cleaned_len", len(cleaned)),
				slog.String("raw_preview", truncateForLog(raw, 500)),
				slog.String("cleaned_preview", truncateForLog(cleaned, 500)),
				slog.String("error", err.Error()),
			)
			return 0, fmt.Errorf("decode distilled questions: %w", err)
		}
		if err2 := json.Unmarshal([]byte(repaired), &payload); err2 != nil {
			slog.Warn("keyword distillation parse failed (repair also failed)",
				slog.Int("raw_len", len(raw)),
				slog.Int("repaired_len", len(repaired)),
				slog.String("raw_preview", truncateForLog(raw, 500)),
				slog.String("repaired_preview", truncateForLog(repaired, 500)),
				slog.String("error", err.Error()),
				slog.String("repair_error", err2.Error()),
			)
			return 0, fmt.Errorf("decode distilled questions: %w (repair also failed: %v)", err, err2)
		}
		slog.Warn("keyword distillation json was truncated, repaired partial content",
			slog.Int("recovered_count", len(payload.Questions)),
		)
	}
	added := 0
	brand = strings.TrimSpace(brand)
	for _, item := range payload.Questions {
		if uint32(len(*merged)) >= requestedCount {
			break
		}
		item.Text = normalizeQuestionText(item.Text)
		item.Audience = strings.TrimSpace(item.Audience)
		if item.Text == "" {
			continue
		}
		// 品牌名清洗：如果问题中包含品牌名，尝试移除后再保留。
		// 例如 "百岁山矿泉水怎么样" -> "矿泉水怎么样"（保留 GEO 价值）。
		if brand != "" && strings.Contains(item.Text, brand) {
			sanitized := removeBrandFromQuestion(item.Text, brand)
			if sanitized == "" {
				continue
			}
			slog.Debug("keyword distillation: removed brand name from question",
				slog.String("original", item.Text),
				slog.String("sanitized", sanitized),
				slog.String("brand", brand),
			)
			item.Text = sanitized
		}
		key := strings.ToLower(item.Text)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		if item.Intent < biz.QuestionIntentEducation || item.Intent > biz.QuestionIntentPurchase {
			item.Intent = biz.QuestionIntentResearch
		}
		if item.FunnelStage < biz.QuestionFunnelAwareness || item.FunnelStage > biz.QuestionFunnelDecision {
			item.FunnelStage = biz.QuestionFunnelConsideration
		}
		*merged = append(*merged, item)
		added++
	}
	return added, nil
}

// removeBrandFromQuestion 从问题文本中移除品牌名，返回清洗后的文本。
// 如果移除品牌名后文本过短（< 4 rune）或无意义，返回空字符串表示应丢弃该问题。
func removeBrandFromQuestion(text, brand string) string {
	if text == "" || brand == "" {
		return text
	}
	sanitized := strings.ReplaceAll(text, brand, "")
	sanitized = strings.Join(strings.Fields(sanitized), " ")
	sanitized = strings.TrimSpace(sanitized)
	// 移除品牌名后，如果剩余文本太短，说明问题本质就是围绕品牌名，应过滤掉。
	runeCount := utf8.RuneCountInString(sanitized)
	if runeCount < 4 {
		return ""
	}
	return sanitized
}

// parseDistilledQuestions 保留为单次解析的便捷入口（供测试直接调用）。
// 内部走 parseDistilledQuestionsWithSeen，使用独立 seen 集合。
// brand 用于清洗问题中可能包含的品牌名。
func parseDistilledQuestions(content string, requestedCount uint32, brand string) (*biz.KeywordDistillationResult, error) {
	seen := make(map[string]struct{}, requestedCount)
	merged := make([]biz.DistilledQuestion, 0, requestedCount)
	if _, err := parseDistilledQuestionsWithSeen(content, requestedCount, seen, &merged, brand); err != nil {
		return nil, err
	}
	return &biz.KeywordDistillationResult{Questions: merged, RawContent: strings.TrimSpace(content)}, nil
}

func normalizeQuestionText(text string) string {
	text = strings.TrimSpace(text)
	if text == "" {
		return ""
	}
	// 去除常见包裹符号和列表前缀。
	text = strings.Trim(text, `"""''"「」【】[]()`)
	text = strings.TrimPrefix(text, "-")
	text = strings.TrimPrefix(text, "*")
	// 去除前端序号，如 "1.", "1、", "Q1. "。
	text = strings.TrimLeftFunc(text, func(r rune) bool { return r >= '0' && r <= '9' })
	text = strings.TrimLeft(text, ".、")
	text = strings.TrimPrefix(text, "Q")
	text = strings.TrimLeftFunc(text, func(r rune) bool { return r >= '0' && r <= '9' })
	text = strings.TrimLeft(text, ".、")
	text = strings.TrimSpace(text)
	// 去除内部 Markdown 强调符号。
	text = strings.ReplaceAll(text, "**", "")
	text = strings.ReplaceAll(text, "*", "")
	// 合并连续空白。
	text = strings.Join(strings.Fields(text), " ")
	return text
}

// truncateForLog 截取字符串前 limit 字节用于日志输出，避免日志爆炸。
// 截断时按 rune 截取，避免中文字符被截断成乱码。
func truncateForLog(s string, limit int) string {
	if len([]rune(s)) <= limit {
		return s
	}
	runes := []rune(s)
	return string(runes[:limit]) + "...(truncated)"
}

func isQuestionSentence(text string) bool {
	if text == "" {
		return false
	}
	last, _ := utf8.DecodeLastRuneInString(text)
	// 常见问句结尾：疑问助词、问号。
	// 注意："么"需排除"什么"结尾，因为"XX是什么"是陈述/科普，不是疑问助词"么"。
	if last == '?' || last == '？' || last == '吗' || last == '呢' || last == '嘛' || last == '吧' {
		return true
	}
	if last == '么' && !strings.HasSuffix(text, "什么") {
		return true
	}
	lower := strings.ToLower(text)
	// GEO 关键词蒸馏的本质：用户向 AI 提这类问题时，AI 的回答会点名提及品牌/产品/服务。
	// 因此只保留"能触发 AI 品牌提及"的问题，过滤掉纯科普/纯知识类问题（如"XX含有什么""XX是什么""XX能放多久"）。
	// 关键词表覆盖全行业 GEO 高频搜索意图：推荐决策、对比评测、评价口碑、品牌厂商等。
	// 注意：只放带品牌提及信号的词组，不放"有哪些""是什么""专业""正规"等单名词，
	// 否则会误保留"XX含有哪些矿物质"这类纯科普问题。
	geoQuestionKeywords := []string{
		// 推荐/决策（GEO 最高价值）
		"推荐", "推介", "求推荐", "有什么推荐", "什么好",
		"排行榜", "排行", "排名", "前十", "十大", "top",
		"哪家好", "哪个好", "哪款好", "哪家强", "哪个牌子好", "哪家专业", "哪家正规",
		"哪个", "哪家", "哪款", // 短疑问词，GEO 场景下几乎总是问句信号
		"怎么选", "如何选", "怎么买", "如何选择", "怎么挑选", "选购指南",
		"选哪个", "买哪个", "选哪款", "挑哪个",
		// 对比/评测
		"对比", "区别", "差异", "差别", "优劣", "优缺点",
		"哪个更好", "哪个更合适", "哪个更划算", "哪个更适合",
		// 评价/口碑
		"怎么样", "怎样", "好不好", "好吗", "靠谱吗", "值得买", "值不值",
		"评测", "测评", "评价", "口碑", "用户体验", "真实体验",
		"性价比", "划算吗", "贵不贵", "踩坑", "避坑",
		// 品牌/厂商（带品牌前缀，避免误判纯科普）
		"品牌有哪些", "品牌排名", "品牌推荐", "十大品牌", "知名品牌",
		"厂家有哪些", "厂商有哪些", "供应商有哪些", "服务商有哪些",
		"哪个厂家", "哪个厂商", "哪个品牌", "哪些品牌",
		// 场景/适用（带推荐词尾的场景问题，AI 回答会点名品牌）
		"适合什么", "适合谁", "适合人群", "适用场景",
		// 价格/成本
		"多少钱", "报价", "费用", "收费",
		// 地域/本地
		"哪里有", "哪里可以", "附近", "本地", "在哪", "哪儿",
		// 风险/安全（带"吗"尾的疑问句，AI 回答会点评品牌的安全性）
		"安全吗", "有风险吗", "有害吗", "副作用", "可靠吗", "稳定吗", "合法吗",
	}
	for _, kw := range geoQuestionKeywords {
		if strings.Contains(lower, kw) {
			return true
		}
	}
	return false
}

func isPunctuationOrSpace(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if !unicode.IsSpace(r) && !unicode.IsPunct(r) && !unicode.IsSymbol(r) {
			return false
		}
	}
	return true
}

// repairTruncatedQuestionsJSON 修复被 max_tokens 截断的 JSON。
// LLM 产出格式为 {"questions":[{...},{...},{...（截断）。
// 策略：找最后一个完整对象的结束 }，截断到那里，去掉尾随逗号，补全 ]} 闭合。
// 如果无法修复（找不到任何完整对象），返回空字符串。
func repairTruncatedQuestionsJSON(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	// 如果已经是合法 JSON，直接返回（调用方已试过，这里兜底）。
	// 找到最后一个 } —— 这通常是最后一个完整 question 对象的结束符。
	lastBrace := strings.LastIndex(s, "}")
	if lastBrace < 0 {
		return ""
	}
	// 截断到最后一个 }，去掉尾随逗号/空白。
	repaired := strings.TrimRight(s[:lastBrace+1], ", \t\n\r")
	// 补全闭合：] 闭合 questions 数组，} 闭合外层对象。
	repaired += "]}"
	return repaired
}
