package data

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"time"

	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/data/model"

	modelopenai "github.com/cloudwego/eino-ext/components/model/openai"
	"github.com/cloudwego/eino/schema"
	"gorm.io/gorm"
)

type einoSalesDiagnosisRunner struct{ data *Data }

func NewEinoSalesDiagnosisRunner(data *Data) biz.SalesDiagnosisRunner {
	return &einoSalesDiagnosisRunner{data: data}
}

type diagnosisPreparationResponse struct {
	Industry     string `json:"industry"`
	BrandSummary string `json:"brand_summary"`
	BrandTerms   []struct {
		Term   string `json:"term"`
		Type   string `json:"type"`
		Reason string `json:"reason"`
	} `json:"brand_terms"`
	Questions []struct {
		Question string `json:"question"`
		Intent   string `json:"intent"`
		Reason   string `json:"reason"`
	} `json:"questions"`
}

func (r *einoSalesDiagnosisRunner) Prepare(ctx context.Context, task *biz.SalesDiagnosisPreparationTask) (*biz.SalesDiagnosisPreparationResult, error) {
	result := &biz.SalesDiagnosisPreparationResult{}
	if task == nil {
		return result, biz.ErrSalesDiagnosisInvalid
	}
	result.PreparationID = task.PreparationID
	result.AttemptNo = task.AttemptNo
	if task.Model == nil || task.Profile == nil || strings.TrimSpace(task.Profile.BrandName) == "" || strings.TrimSpace(task.Profile.CustomerName) == "" {
		return result, biz.ErrSalesDiagnosisInvalid
	}
	chatModel, err := r.diagnosisChatModel(ctx, task.Model)
	if err != nil {
		return result, err
	}
	profileJSON, err := json.Marshal(map[string]any{
		"customer_name":     task.Profile.CustomerName,
		"brand_name":        task.Profile.BrandName,
		"website":           task.Profile.Website,
		"industry":          task.Profile.Industry,
		"region":            task.Profile.Region,
		"known_aliases":     task.Profile.BrandAliases,
		"known_products":    task.Profile.Products,
		"known_competitors": task.Profile.Competitors,
	})
	if err != nil {
		return result, fmt.Errorf("marshal diagnosis preparation profile: %w", err)
	}
	systemPrompt := `你是 GEO 售前诊断的问题研究员。先识别正确的客户主体和品牌，再生成后续将原样发送给多个大模型平台的统一测试问题。若接口具备联网检索能力，应优先检索公开资料完成主体辨识；不得把同名品牌、无关行业或不确定事实混入结果。只输出一个 JSON 对象，不要输出 Markdown：
{"industry":"行业","brand_summary":"不超过300字的主体与业务摘要","brand_terms":[{"term":"品牌词","type":"brand|alias|product|category|competitor|scenario","reason":"用途或依据"}],"questions":[{"question":"完整问题","intent":"主体认知|品类推荐|竞品对比|信息完整度|信源与口碑|决策评价","reason":"该问题要验证的指标"}]}
要求：brand_terms 包含目标品牌、可靠别名、核心产品/服务、品类词、竞品词和典型需求场景；不确定的词不要输出。questions 生成 5 到 12 条，每一条都必须明确写出目标品牌名称，并覆盖品牌认知、品类推荐、明确推荐位次、竞品对比、引用来源、信息完整度、时效性和口碑/负面风险。问题应像真实潜在客户提问，不得暗示模型必须推荐目标品牌。`
	userPrompt := "客户与品牌资料：" + string(profileJSON)
	result.PromptSnapshot = systemPrompt + "\n\n" + userPrompt
	started := time.Now()
	response, err := r.generateDiagnosisMessage(ctx, chatModel, task.Model, []*schema.Message{
		schema.SystemMessage(systemPrompt), schema.UserMessage(userPrompt),
	})
	result.DurationMS = uint64(time.Since(started).Milliseconds())
	if err != nil {
		return result, fmt.Errorf("call diagnosis preparation model: %w", err)
	}
	result.ResponseModel = task.Model.ModelID
	if responseModel := diagnosisProviderResponseModel(response.Extra); responseModel != "" {
		result.ResponseModel = responseModel
	}
	result.ProviderRequestID = diagnosisProviderRequestID(response.Extra)
	result.RawResponseJSON = diagnosisRawResponseJSON(response)
	if response.ResponseMeta != nil && response.ResponseMeta.Usage != nil {
		result.InputTokens = uint64(max(response.ResponseMeta.Usage.PromptTokens, 0))
		result.OutputTokens = uint64(max(response.ResponseMeta.Usage.CompletionTokens, 0))
	}
	result.CostMicros = diagnosisCostMicros(task.Model, result.InputTokens, result.OutputTokens)
	var decoded diagnosisPreparationResponse
	if err := json.Unmarshal([]byte(extractDiagnosisJSONObject(response.Content)), &decoded); err != nil {
		return result, fmt.Errorf("decode diagnosis preparation response: %w", err)
	}
	result.Industry = strings.TrimSpace(decoded.Industry)
	result.BrandSummary = strings.TrimSpace(decoded.BrandSummary)
	result.BrandTerms = normalizeDiagnosisPreparationTerms(task.Profile.BrandName, decoded.BrandTerms)
	result.Questions = normalizeDiagnosisPreparationQuestions(task.Profile.BrandName, decoded.Questions)
	if len(result.BrandTerms) == 0 || len(result.Questions) < 5 {
		return result, errors.New("diagnosis preparation returned insufficient brand terms or questions")
	}
	result.Succeeded = true
	return result, nil
}

func (r *einoSalesDiagnosisRunner) diagnosisChatModel(ctx context.Context, diagnosisModel *biz.SalesDiagnosisModel) (*modelopenai.ChatModel, error) {
	if diagnosisModel == nil || diagnosisModel.Protocol != model.WritingModelProtocolOpenAICompatible {
		return nil, fmt.Errorf("unsupported diagnosis model protocol")
	}
	var credential model.WritingModelCredential
	if err := r.data.DB(ctx).Where("writing_model_id = ?", diagnosisModel.WritingModelID).First(&credential).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("diagnosis model credential is not configured")
		}
		return nil, fmt.Errorf("load diagnosis model credential: %w", err)
	}
	apiKey, err := r.data.openCredential(credential.Nonce, credential.Ciphertext, []byte(fmt.Sprintf("writing-model:%d", diagnosisModel.WritingModelID)))
	if err != nil {
		return nil, fmt.Errorf("open diagnosis model credential: %w", err)
	}
	defer clear(apiKey)
	temperature := float32(diagnosisModel.Temperature)
	topP := float32(diagnosisModel.TopP)
	maxTokens := int(diagnosisModel.MaxTokens)
	chatModel, err := modelopenai.NewChatModel(ctx, &modelopenai.ChatModelConfig{
		APIKey: string(apiKey), BaseURL: strings.TrimRight(diagnosisModel.BaseURL, "/"), Model: diagnosisModel.ModelID,
		Timeout:     time.Duration(diagnosisModel.TimeoutSeconds) * time.Second,
		Temperature: &temperature, TopP: &topP, MaxTokens: &maxTokens,
	})
	if err != nil {
		return nil, fmt.Errorf("create Eino diagnosis model: %w", err)
	}
	return chatModel, nil
}

func (r *einoSalesDiagnosisRunner) generateDiagnosisMessage(ctx context.Context, chatModel *modelopenai.ChatModel, diagnosisModel *biz.SalesDiagnosisModel, messages []*schema.Message) (*schema.Message, error) {
	if diagnosisModel.DiagnosisAPIMode == model.WritingModelDiagnosisAPIResponses {
		return r.generateDiagnosisResponses(ctx, diagnosisModel, messages)
	}
	if diagnosisModel.Provider == model.WritingModelProviderQwen &&
		diagnosisModel.CitationCapability == model.SalesDiagnosisCitationCapabilityProviderSources {
		return chatModel.Generate(ctx, messages, modelopenai.WithExtraFields(map[string]any{
			"enable_search": true, "search_options": map[string]any{"forced_search": true},
		}))
	}
	return chatModel.Generate(ctx, messages)
}

func normalizeDiagnosisPreparationTerms(brandName string, values []struct {
	Term   string `json:"term"`
	Type   string `json:"type"`
	Reason string `json:"reason"`
}) []*biz.SalesDiagnosisBrandTerm {
	items := []*biz.SalesDiagnosisBrandTerm{{Term: strings.TrimSpace(brandName), TermType: biz.SalesDiagnosisBrandTermTypeBrand, Reason: "用户指定的目标品牌"}}
	seen := map[string]struct{}{strings.ToLower(strings.TrimSpace(brandName)) + ":1": {}}
	for _, value := range values {
		term := strings.TrimSpace(value.Term)
		termType := diagnosisBrandTermType(value.Type)
		key := strings.ToLower(term) + ":" + fmt.Sprint(termType)
		if term == "" || termType == 0 {
			continue
		}
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		items = append(items, &biz.SalesDiagnosisBrandTerm{
			Term: term, TermType: termType, Reason: strings.TrimSpace(value.Reason), SortOrder: int32(len(items)),
		})
		if len(items) >= 30 {
			break
		}
	}
	return items
}

func normalizeDiagnosisPreparationQuestions(brandName string, values []struct {
	Question string `json:"question"`
	Intent   string `json:"intent"`
	Reason   string `json:"reason"`
}) []*biz.SalesDiagnosisGeneratedQuestion {
	items := make([]*biz.SalesDiagnosisGeneratedQuestion, 0, min(len(values), 12))
	seen := make(map[string]struct{}, len(values))
	lowerBrand := strings.ToLower(strings.TrimSpace(brandName))
	for _, value := range values {
		question := strings.TrimSpace(value.Question)
		key := strings.ToLower(question)
		if question == "" || !strings.Contains(key, lowerBrand) {
			continue
		}
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		items = append(items, &biz.SalesDiagnosisGeneratedQuestion{
			Question: question, Intent: strings.TrimSpace(value.Intent), Reason: strings.TrimSpace(value.Reason),
		})
		if len(items) >= 12 {
			break
		}
	}
	return items
}

func diagnosisBrandTermType(value string) int32 {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "brand":
		return biz.SalesDiagnosisBrandTermTypeBrand
	case "alias":
		return biz.SalesDiagnosisBrandTermTypeAlias
	case "product":
		return biz.SalesDiagnosisBrandTermTypeProduct
	case "category":
		return biz.SalesDiagnosisBrandTermTypeCategory
	case "competitor":
		return biz.SalesDiagnosisBrandTermTypeCompetitor
	case "scenario":
		return biz.SalesDiagnosisBrandTermTypeScenario
	default:
		return 0
	}
}

func (r *einoSalesDiagnosisRunner) Run(ctx context.Context, task *biz.SalesDiagnosisRunTask) (*biz.SalesDiagnosisResult, error) {
	result := &biz.SalesDiagnosisResult{EvidenceType: biz.SalesDiagnosisEvidenceModelKnowledge}
	if task == nil {
		return result, biz.ErrSalesDiagnosisInvalid
	}
	result.TaskID = task.TaskID
	result.AttemptNo = task.AttemptNo
	if task.Model == nil || task.Profile == nil || strings.TrimSpace(task.Question) == "" {
		return result, biz.ErrSalesDiagnosisInvalid
	}
	chatModel, err := r.diagnosisChatModel(ctx, task.Model)
	if err != nil {
		return result, err
	}
	systemPrompt := fmt.Sprintf("你正在参与一次独立的 GEO 可见度诊断。诊断对象是品牌%s，客户主体是%s。请先辨识正确主体，所有回答都必须围绕该品牌实际所属的业务、行业和竞争环境；若无法可靠辨识，请明确说明，不得推荐无关品牌。请像真实用户咨询一样直接、客观地回答，不要因为测试目的而刻意给出正面评价、虚构推荐或排名。", task.Profile.BrandName, task.Profile.CustomerName) +
		"如果接口具备联网检索能力，请优先检索并依据可核验的公开资料回答；如果不具备联网能力，请明确仅依据已有模型知识，不要虚构实时搜索、来源或引用。" +
		"回答应包含明确的推荐理由、必要的品牌对比，并尽量说明信息时效。" + diagnosisPreparationPromptContext(task.BrandTerms)
	result.PromptSnapshot = systemPrompt + "\n\n用户问题：" + task.Question
	started := time.Now()
	messages := []*schema.Message{schema.SystemMessage(systemPrompt), schema.UserMessage(task.Question)}
	response, err := r.generateDiagnosisMessage(ctx, chatModel, task.Model, messages)
	result.DurationMS = uint64(time.Since(started).Milliseconds())
	if err != nil {
		return result, fmt.Errorf("call diagnosis model: %w", err)
	}
	result.Answer = strings.TrimSpace(response.Content)
	if result.Answer == "" {
		return result, errors.New("diagnosis model returned empty content")
	}
	result.Succeeded = true
	result.ResponseModel = task.Model.ModelID
	if responseModel := diagnosisProviderResponseModel(response.Extra); responseModel != "" {
		result.ResponseModel = responseModel
	}
	result.ProviderRequestID = diagnosisProviderRequestID(response.Extra)
	result.Citations = diagnosisProviderCitations(response.Extra)
	classifyDiagnosisCitationOwnership(result.Citations, task.Profile)
	classifyDiagnosisCitationSources(result.Citations, task.Profile)
	if len(result.Citations) > 0 {
		result.EvidenceType = biz.SalesDiagnosisEvidenceProviderSources
	}
	result.RawResponseJSON = diagnosisRawResponseJSON(response)
	if response.ResponseMeta != nil && response.ResponseMeta.Usage != nil {
		result.InputTokens = uint64(max(response.ResponseMeta.Usage.PromptTokens, 0))
		result.OutputTokens = uint64(max(response.ResponseMeta.Usage.CompletionTokens, 0))
	}
	result.CostMicros = diagnosisCostMicros(task.Model, result.InputTokens, result.OutputTokens)
	targetNames := diagnosisTargetNames(task.Profile, task.BrandTerms)
	result.BrandPosition = firstDiagnosisMentionPosition(result.Answer, targetNames)
	result.BrandMentioned = result.BrandPosition > 0
	for _, competitor := range task.Profile.Competitors {
		if competitor == nil {
			continue
		}
		position := firstDiagnosisMentionPosition(result.Answer, []string{competitor.Name})
		if position == 0 {
			continue
		}
		result.CompetitorMentions = append(result.CompetitorMentions, &biz.SalesDiagnosisCompetitorMention{
			CompetitorName: competitor.Name, Position: position,
		})
	}
	for _, competitorName := range diagnosisPreparedCompetitors(task.BrandTerms) {
		position := firstDiagnosisMentionPosition(result.Answer, []string{competitorName})
		if position == 0 || containsDiagnosisCompetitorMention(result.CompetitorMentions, competitorName) {
			continue
		}
		result.CompetitorMentions = append(result.CompetitorMentions, &biz.SalesDiagnosisCompetitorMention{
			CompetitorName: competitorName, Position: position,
		})
	}
	analysis, analysisInputTokens, analysisOutputTokens := runStructuredDiagnosisAnalysis(ctx, chatModel, task, result.Answer)
	result.Analysis = analysis
	result.InputTokens += analysisInputTokens
	result.OutputTokens += analysisOutputTokens
	result.CostMicros = diagnosisCostMicros(task.Model, result.InputTokens, result.OutputTokens)
	result.DurationMS = uint64(time.Since(started).Milliseconds())
	return result, nil
}

type diagnosisAnalyzerResponse struct {
	DominantSentiment  string  `json:"dominant_sentiment"`
	Confidence         float64 `json:"confidence"`
	Included           bool    `json:"included"`
	CompletenessScore  float64 `json:"completeness_score"`
	AnswerQualityScore float64 `json:"answer_quality_score"`
	FreshnessScore     float64 `json:"freshness_score"`
	FreshnessAvailable bool    `json:"freshness_available"`
	AnswerSummary      string  `json:"answer_summary"`
	Strengths          string  `json:"strengths"`
	Gaps               string  `json:"gaps"`
	RankedEntities     []struct {
		Name       string  `json:"name"`
		Rank       int32   `json:"rank"`
		Sentiment  string  `json:"sentiment"`
		Confidence float64 `json:"confidence"`
		Evidence   string  `json:"evidence"`
	} `json:"ranked_entities"`
	ClaimMatches []struct {
		ClaimID    uint64  `json:"claim_id"`
		Matched    bool    `json:"matched"`
		Confidence float64 `json:"confidence"`
		Evidence   string  `json:"evidence"`
	} `json:"claim_matches"`
}

func runStructuredDiagnosisAnalysis(ctx context.Context, chatModel *modelopenai.ChatModel, task *biz.SalesDiagnosisRunTask, answer string) (*biz.SalesDiagnosisResultAnalysis, uint64, uint64) {
	analysis := deterministicDiagnosisAnalysis(task, answer)
	claims := make([]map[string]any, 0, len(task.Profile.Claims))
	for _, claim := range task.Profile.Claims {
		claims = append(claims, map[string]any{"claim_id": claim.ID, "claim_text": claim.ClaimText})
	}
	competitors := make([]string, 0, len(task.Profile.Competitors))
	for _, competitor := range task.Profile.Competitors {
		if competitor != nil {
			competitors = append(competitors, competitor.Name)
		}
	}
	competitors = append(competitors, diagnosisPreparedCompetitors(task.BrandTerms)...)
	profileJSON, err := json.Marshal(map[string]any{
		"target_brand":           task.Profile.BrandName,
		"target_aliases":         diagnosisTargetNames(task.Profile, task.BrandTerms)[1:],
		"configured_competitors": competitors,
		"official_claims":        claims,
	})
	if err != nil {
		analysis.ErrorMessage = err.Error()
		return analysis, 0, 0
	}
	systemPrompt := fmt.Sprintf(`你是 GEO 售前诊断证据分析器。当前日期是 %s。只能依据给定回答和冻结客户事实抽取信息，不得补充外部知识。输出一个 JSON 对象，不要输出 Markdown：
{"dominant_sentiment":"positive|neutral|negative|unknown","confidence":0到1,"included":布尔值,"completeness_score":0到1,"answer_quality_score":0到1,"freshness_score":0到1,"freshness_available":布尔值,"answer_summary":"不超过160字的事实摘要","strengths":"不超过160字的优势表现","gaps":"不超过160字且采用AI可抓取内容供给口径的待优化点","ranked_entities":[{"name":"回答中原样出现的品牌","rank":仅明确排名时填正整数否则0,"sentiment":"positive|neutral|negative|unknown","confidence":0到1,"evidence":"回答中的短原文"}],"claim_matches":[{"claim_id":数字,"matched":布尔值,"confidence":0到1,"evidence":"回答中的短原文"}]}
评分规则：included 只表示目标品牌是否真实出现在回答；completeness_score 衡量冻结官方事实被覆盖程度；answer_quality_score 衡量回答是否准确、具体、有理由且可核验；只有回答包含明确日期、更新信息或可核验实时来源时 freshness_available 才为 true，否则 freshness_score 必须为0。品牌必须在回答中真实出现；排名必须有明确顺序证据；每个 official_claim 都必须返回一项，只有回答表达了该事实才 matched=true。`, time.Now().UTC().Format("2006-01-02"))
	userPrompt := "诊断上下文：" + string(profileJSON) + "\n\n待分析回答：\n" + answer
	analysis.PromptSnapshot = systemPrompt + "\n\n" + userPrompt
	response, err := chatModel.Generate(ctx, []*schema.Message{schema.SystemMessage(systemPrompt), schema.UserMessage(userPrompt)})
	if err != nil {
		analysis.ErrorMessage = truncateDiagnosisError(err.Error())
		return analysis, 0, 0
	}
	var inputTokens, outputTokens uint64
	if response.ResponseMeta != nil && response.ResponseMeta.Usage != nil {
		inputTokens = uint64(max(response.ResponseMeta.Usage.PromptTokens, 0))
		outputTokens = uint64(max(response.ResponseMeta.Usage.CompletionTokens, 0))
	}
	if raw, marshalErr := json.Marshal(response); marshalErr == nil {
		analysis.RawResponseJSON = string(raw)
	}
	var decoded diagnosisAnalyzerResponse
	if err := json.Unmarshal([]byte(extractDiagnosisJSONObject(response.Content)), &decoded); err != nil {
		analysis.ErrorMessage = truncateDiagnosisError("invalid analyzer response: " + err.Error())
		return analysis, inputTokens, outputTokens
	}
	analysis.Status = biz.SalesDiagnosisAnalysisStatusSucceeded
	analysis.DominantSentiment = diagnosisSentimentCode(decoded.DominantSentiment)
	analysis.Confidence = diagnosisConfidence(decoded.Confidence)
	analysis.Included = analysis.EntityMentions[0].MentionCount > 0
	analysis.CompletenessScore = diagnosisConfidence(decoded.CompletenessScore)
	analysis.AnswerQualityScore = diagnosisConfidence(decoded.AnswerQualityScore)
	analysis.FreshnessAvailable = decoded.FreshnessAvailable
	if decoded.FreshnessAvailable {
		analysis.FreshnessScore = diagnosisConfidence(decoded.FreshnessScore)
	}
	analysis.AnswerSummary = truncateDiagnosisText(decoded.AnswerSummary, 500)
	analysis.Strengths = truncateDiagnosisText(decoded.Strengths, 500)
	analysis.Gaps = truncateDiagnosisText(decoded.Gaps, 500)
	configured := make(map[string]struct{}, len(task.Profile.Competitors))
	for _, competitor := range task.Profile.Competitors {
		if competitor != nil {
			configured[strings.ToLower(strings.TrimSpace(competitor.Name))] = struct{}{}
		}
	}
	for _, competitorName := range diagnosisPreparedCompetitors(task.BrandTerms) {
		configured[strings.ToLower(competitorName)] = struct{}{}
	}
	byName := make(map[string]*biz.SalesDiagnosisEntityMention, len(analysis.EntityMentions))
	for _, mention := range analysis.EntityMentions {
		byName[strings.ToLower(mention.EntityName)] = mention
	}
	for _, alias := range diagnosisTargetNames(task.Profile, task.BrandTerms)[1:] {
		byName[strings.ToLower(strings.TrimSpace(alias))] = analysis.EntityMentions[0]
	}
	for _, entity := range decoded.RankedEntities {
		name := strings.TrimSpace(entity.Name)
		key := strings.ToLower(name)
		if name == "" || !strings.Contains(strings.ToLower(answer), key) {
			continue
		}
		mention, exists := byName[key]
		if !exists {
			entityType := biz.SalesDiagnosisEntityOtherBrand
			if _, ok := configured[key]; ok {
				entityType = biz.SalesDiagnosisEntityConfiguredCompetitor
			}
			mention = &biz.SalesDiagnosisEntityMention{
				EntityType: entityType, EntityName: name, MentionCount: diagnosisMentionCount(answer, []string{name}),
				FirstPosition: firstDiagnosisMentionPosition(answer, []string{name}),
			}
			analysis.EntityMentions = append(analysis.EntityMentions, mention)
			byName[key] = mention
		}
		if entity.Rank > 0 {
			mention.RankPosition = entity.Rank
		}
		mention.Sentiment = diagnosisSentimentCode(entity.Sentiment)
		mention.Confidence = diagnosisConfidence(entity.Confidence)
		mention.EvidenceExcerpt = verifiedDiagnosisEvidence(answer, entity.Evidence)
		if mention.EntityType == biz.SalesDiagnosisEntityTargetBrand && mention.RankPosition > 0 {
			analysis.RecommendationPosition = mention.RankPosition
		}
	}
	claimByID := make(map[uint64]*biz.SalesDiagnosisClaimMatch, len(analysis.ClaimMatches))
	for _, match := range analysis.ClaimMatches {
		claimByID[match.ClaimID] = match
	}
	seenClaims := make(map[uint64]struct{}, len(decoded.ClaimMatches))
	for _, candidate := range decoded.ClaimMatches {
		match, ok := claimByID[candidate.ClaimID]
		if !ok {
			continue
		}
		seenClaims[candidate.ClaimID] = struct{}{}
		match.Matched = candidate.Matched
		match.Confidence = diagnosisConfidence(candidate.Confidence)
		match.EvidenceExcerpt = verifiedDiagnosisEvidence(answer, candidate.Evidence)
		if match.Matched && match.EvidenceExcerpt == "" {
			match.Matched = false
			match.Confidence = 0
		}
	}
	if len(seenClaims) != len(analysis.ClaimMatches) {
		analysis.Status = biz.SalesDiagnosisAnalysisStatusPartial
		analysis.ErrorMessage = "结构分析未覆盖全部冻结官方事实，内容采纳率不可用"
	}
	return analysis, inputTokens, outputTokens
}

func deterministicDiagnosisAnalysis(task *biz.SalesDiagnosisRunTask, answer string) *biz.SalesDiagnosisResultAnalysis {
	analysis := &biz.SalesDiagnosisResultAnalysis{
		AnalysisVersion: 1, RuleVersion: "geo-report-v4", AnalyzerKind: biz.SalesDiagnosisAnalyzerHybrid,
		AnalyzerModelName: task.Model.ModelID, Status: biz.SalesDiagnosisAnalysisStatusPartial,
		DominantSentiment: biz.SalesDiagnosisSentimentUnknown,
	}
	targetNames := diagnosisTargetNames(task.Profile, task.BrandTerms)
	analysis.EntityMentions = append(analysis.EntityMentions, &biz.SalesDiagnosisEntityMention{
		EntityType: biz.SalesDiagnosisEntityTargetBrand, EntityName: task.Profile.BrandName,
		MentionCount: diagnosisMentionCount(answer, targetNames), FirstPosition: firstDiagnosisMentionPosition(answer, targetNames),
		Sentiment: biz.SalesDiagnosisSentimentUnknown, Confidence: 1,
	})
	analysis.Included = analysis.EntityMentions[0].MentionCount > 0
	for _, competitor := range task.Profile.Competitors {
		if competitor == nil || strings.TrimSpace(competitor.Name) == "" {
			continue
		}
		analysis.EntityMentions = append(analysis.EntityMentions, &biz.SalesDiagnosisEntityMention{
			EntityType: biz.SalesDiagnosisEntityConfiguredCompetitor, EntityName: competitor.Name,
			MentionCount:  diagnosisMentionCount(answer, []string{competitor.Name}),
			FirstPosition: firstDiagnosisMentionPosition(answer, []string{competitor.Name}),
			Sentiment:     biz.SalesDiagnosisSentimentUnknown, Confidence: 1,
		})
	}
	for _, competitorName := range diagnosisPreparedCompetitors(task.BrandTerms) {
		if containsDiagnosisEntity(analysis.EntityMentions, competitorName) {
			continue
		}
		analysis.EntityMentions = append(analysis.EntityMentions, &biz.SalesDiagnosisEntityMention{
			EntityType: biz.SalesDiagnosisEntityConfiguredCompetitor, EntityName: competitorName,
			MentionCount:  diagnosisMentionCount(answer, []string{competitorName}),
			FirstPosition: firstDiagnosisMentionPosition(answer, []string{competitorName}),
			Sentiment:     biz.SalesDiagnosisSentimentUnknown, Confidence: 1,
		})
	}
	for _, claim := range task.Profile.Claims {
		analysis.ClaimMatches = append(analysis.ClaimMatches, &biz.SalesDiagnosisClaimMatch{ClaimID: claim.ID})
	}
	return analysis
}

func diagnosisPreparationPromptContext(terms []*biz.SalesDiagnosisBrandTerm) string {
	if len(terms) == 0 {
		return ""
	}
	values := make([]string, 0, len(terms))
	for _, item := range terms {
		if item == nil || strings.TrimSpace(item.Term) == "" {
			continue
		}
		values = append(values, item.Term)
	}
	if len(values) == 0 {
		return ""
	}
	return "前置研究已确认的主体相关词包括：" + strings.Join(values, "、") + "。这些词只用于主体辨识和分析上下文，不代表回答必须提及。"
}

func diagnosisTargetNames(profile *biz.SalesDiagnosisProfile, terms []*biz.SalesDiagnosisBrandTerm) []string {
	if profile == nil {
		return nil
	}
	values := append([]string{profile.BrandName}, profile.BrandAliases...)
	for _, item := range terms {
		if item != nil && (item.TermType == biz.SalesDiagnosisBrandTermTypeBrand || item.TermType == biz.SalesDiagnosisBrandTermTypeAlias) {
			values = append(values, item.Term)
		}
	}
	return uniqueDiagnosisStrings(values)
}

func diagnosisPreparedCompetitors(terms []*biz.SalesDiagnosisBrandTerm) []string {
	values := make([]string, 0)
	for _, item := range terms {
		if item != nil && item.TermType == biz.SalesDiagnosisBrandTermTypeCompetitor {
			values = append(values, item.Term)
		}
	}
	return uniqueDiagnosisStrings(values)
}

func uniqueDiagnosisStrings(values []string) []string {
	items := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		key := strings.ToLower(value)
		if value == "" {
			continue
		}
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		items = append(items, value)
	}
	return items
}

func containsDiagnosisCompetitorMention(items []*biz.SalesDiagnosisCompetitorMention, name string) bool {
	for _, item := range items {
		if item != nil && strings.EqualFold(strings.TrimSpace(item.CompetitorName), strings.TrimSpace(name)) {
			return true
		}
	}
	return false
}

func containsDiagnosisEntity(items []*biz.SalesDiagnosisEntityMention, name string) bool {
	for _, item := range items {
		if item != nil && strings.EqualFold(strings.TrimSpace(item.EntityName), strings.TrimSpace(name)) {
			return true
		}
	}
	return false
}

func truncateDiagnosisText(value string, limit int) string {
	runes := []rune(strings.TrimSpace(value))
	if len(runes) <= limit {
		return string(runes)
	}
	return string(runes[:limit])
}

func diagnosisMentionCount(content string, names []string) uint32 {
	lowerContent := strings.ToLower(content)
	seen := make(map[string]struct{}, len(names))
	uniqueNames := make([]string, 0, len(names))
	for _, name := range names {
		name = strings.ToLower(strings.TrimSpace(name))
		if name == "" {
			continue
		}
		if _, exists := seen[name]; exists {
			continue
		}
		seen[name] = struct{}{}
		uniqueNames = append(uniqueNames, name)
	}
	sort.Slice(uniqueNames, func(i, j int) bool { return len(uniqueNames[i]) > len(uniqueNames[j]) })
	type span struct{ start, end int }
	spans := make([]span, 0)
	var count uint32
	for _, name := range uniqueNames {
		for offset := 0; offset < len(lowerContent); {
			index := strings.Index(lowerContent[offset:], name)
			if index < 0 {
				break
			}
			start := offset + index
			end := start + len(name)
			overlaps := false
			for _, existing := range spans {
				if start < existing.end && end > existing.start {
					overlaps = true
					break
				}
			}
			if !overlaps {
				spans = append(spans, span{start: start, end: end})
				count++
			}
			offset = end
		}
	}
	return count
}

func diagnosisSentimentCode(value string) int32 {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "positive":
		return biz.SalesDiagnosisSentimentPositive
	case "neutral":
		return biz.SalesDiagnosisSentimentNeutral
	case "negative":
		return biz.SalesDiagnosisSentimentNegative
	default:
		return biz.SalesDiagnosisSentimentUnknown
	}
}

func diagnosisConfidence(value float64) float64 {
	if value < 0 {
		return 0
	}
	if value > 1 {
		return 1
	}
	return value
}

func verifiedDiagnosisEvidence(answer, evidence string) string {
	evidence = strings.TrimSpace(evidence)
	if evidence == "" || !strings.Contains(answer, evidence) {
		return ""
	}
	runes := []rune(evidence)
	if len(runes) > 300 {
		return string(runes[:300])
	}
	return evidence
}

func extractDiagnosisJSONObject(value string) string {
	start := strings.Index(value, "{")
	end := strings.LastIndex(value, "}")
	if start < 0 || end < start {
		return value
	}
	return value[start : end+1]
}

func diagnosisProviderRequestID(extra map[string]any) string {
	for _, key := range []string{"openai-request-id", "request_id", "request-id", "x-request-id"} {
		if value := findDiagnosisExtraString(extra, key); value != "" {
			return value
		}
	}
	return ""
}

func diagnosisProviderResponseModel(extra map[string]any) string {
	for _, key := range []string{"response_model", "model"} {
		if value := findDiagnosisExtraString(extra, key); value != "" {
			return value
		}
	}
	return ""
}

func findDiagnosisExtraString(value any, target string) string {
	switch item := value.(type) {
	case map[string]any:
		for key, child := range item {
			if strings.EqualFold(key, target) {
				if text, ok := child.(string); ok {
					return strings.TrimSpace(text)
				}
			}
			if found := findDiagnosisExtraString(child, target); found != "" {
				return found
			}
		}
	case []any:
		for _, child := range item {
			if found := findDiagnosisExtraString(child, target); found != "" {
				return found
			}
		}
	}
	return ""
}

func diagnosisProviderCitations(extra map[string]any) []*biz.SalesDiagnosisCitation {
	items := make([]*biz.SalesDiagnosisCitation, 0)
	seen := make(map[string]struct{})
	var walk func(any)
	walk = func(value any) {
		switch item := value.(type) {
		case map[string]any:
			rawURL, _ := item["url"].(string)
			rawURL = strings.TrimSpace(rawURL)
			parsed, err := url.Parse(rawURL)
			if err == nil && (parsed.Scheme == "http" || parsed.Scheme == "https") && parsed.Hostname() != "" {
				if _, exists := seen[rawURL]; !exists {
					seen[rawURL] = struct{}{}
					citation := &biz.SalesDiagnosisCitation{
						URL: rawURL, Domain: strings.ToLower(parsed.Hostname()), SortOrder: int32(len(items)),
						CapturedAt: timePointer(time.Now().UTC()), VerificationStatus: 1, OwnershipType: 1,
					}
					citation.Title, _ = item["title"].(string)
					citation.SourceName, _ = item["source_name"].(string)
					citation.Snippet, _ = item["snippet"].(string)
					citation.ProviderSourceID, _ = item["id"].(string)
					if citation.SourceName == "" {
						citation.SourceName, _ = item["name"].(string)
					}
					if citation.Snippet == "" {
						citation.Snippet, _ = item["description"].(string)
					}
					items = append(items, citation)
				}
			}
			for _, child := range item {
				walk(child)
			}
		case []any:
			for _, child := range item {
				walk(child)
			}
		}
	}
	walk(extra)
	return items
}

func classifyDiagnosisCitationOwnership(citations []*biz.SalesDiagnosisCitation, profile *biz.SalesDiagnosisProfile) {
	if profile == nil {
		return
	}
	targetDomain := diagnosisHostname(profile.Website)
	competitorDomains := make(map[string]struct{}, len(profile.Competitors))
	for _, competitor := range profile.Competitors {
		if competitor == nil {
			continue
		}
		if domain := diagnosisHostname(competitor.Website); domain != "" {
			competitorDomains[domain] = struct{}{}
		}
	}
	for _, citation := range citations {
		if citation == nil {
			continue
		}
		domain := strings.TrimPrefix(strings.ToLower(citation.Domain), "www.")
		switch {
		case targetDomain != "" && domain == targetDomain:
			citation.OwnershipType = 2
		case domain != "":
			if _, ok := competitorDomains[domain]; ok {
				citation.OwnershipType = 3
			}
		}
	}
}

func classifyDiagnosisCitationSources(citations []*biz.SalesDiagnosisCitation, profile *biz.SalesDiagnosisProfile) {
	targetDomain := ""
	if profile != nil {
		targetDomain = diagnosisHostname(profile.Website)
	}
	for _, citation := range citations {
		if citation == nil {
			continue
		}
		domain := strings.ToLower(strings.TrimPrefix(citation.Domain, "www."))
		text := strings.ToLower(strings.Join([]string{domain, citation.SourceName, citation.Title}, " "))
		switch {
		case citation.OwnershipType == 2 || citation.OwnershipType == 3 ||
			(targetDomain != "" && domain == targetDomain) || strings.HasSuffix(domain, ".gov.cn") ||
			strings.Contains(text, "政府") || strings.Contains(text, "委员会") || strings.Contains(text, "官方"):
			citation.SourceType = biz.SalesDiagnosisSourceOfficial
		case strings.Contains(text, "baike") || strings.Contains(text, "百科") || strings.Contains(text, "wiki"):
			citation.SourceType = biz.SalesDiagnosisSourceEncyclopedia
		case strings.Contains(text, "news") || strings.Contains(text, "新闻") || strings.Contains(text, "日报") || strings.Contains(text, "网讯"):
			citation.SourceType = biz.SalesDiagnosisSourceNews
		case strings.Contains(text, "ota") || strings.Contains(text, "ticket") || strings.Contains(text, "票务") || strings.Contains(text, "预订"):
			citation.SourceType = biz.SalesDiagnosisSourceOTA
		case strings.Contains(text, "guide") || strings.Contains(text, "攻略") || strings.Contains(text, "游记"):
			citation.SourceType = biz.SalesDiagnosisSourceTravelGuide
		case strings.Contains(text, "community") || strings.Contains(text, "社区") || strings.Contains(text, "ugc") || strings.Contains(text, "blog"):
			citation.SourceType = biz.SalesDiagnosisSourceCommunityUGC
		case strings.Contains(text, "doc") || strings.Contains(text, "文库") || strings.Contains(text, "资料"):
			citation.SourceType = biz.SalesDiagnosisSourceDocumentLibrary
		case strings.Contains(text, "industry") || strings.Contains(text, "行业") || strings.Contains(text, "协会"):
			citation.SourceType = biz.SalesDiagnosisSourceIndustryMedia
		default:
			citation.SourceType = biz.SalesDiagnosisSourceOther
		}
	}
}

func diagnosisHostname(rawURL string) string {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return ""
	}
	if !strings.Contains(rawURL, "://") {
		rawURL = "https://" + rawURL
	}
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	return strings.TrimPrefix(strings.ToLower(parsed.Hostname()), "www.")
}

func timePointer(value time.Time) *time.Time { return &value }

func firstDiagnosisMentionPosition(content string, names []string) int32 {
	lowerContent := strings.ToLower(content)
	position := -1
	for _, name := range names {
		name = strings.ToLower(strings.TrimSpace(name))
		if name == "" {
			continue
		}
		index := strings.Index(lowerContent, name)
		if index >= 0 && (position == -1 || index < position) {
			position = index
		}
	}
	if position < 0 {
		return 0
	}
	return int32(len([]rune(content[:position])) + 1)
}

func diagnosisCostMicros(model *biz.SalesDiagnosisModel, inputTokens, outputTokens uint64) int64 {
	if model == nil || model.InputPriceMicrosPerMillionTokens < 0 || model.OutputPriceMicrosPerMillionTokens < 0 {
		return 0
	}
	return int64(inputTokens)*model.InputPriceMicrosPerMillionTokens/1_000_000 +
		int64(outputTokens)*model.OutputPriceMicrosPerMillionTokens/1_000_000
}
