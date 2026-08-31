package data

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/data/model"

	modelopenai "github.com/cloudwego/eino-ext/components/model/openai"
	"github.com/cloudwego/eino/schema"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// opinionCategories 是舆情总结的固定分类集合（与前端展示一一对应）。
var opinionCategories = []string{"product", "service", "price", "competitor", "other", "suggestion"}

// opinionCategoryNames 分类中文标题（生成 prompt 与前端兜底共用）。
var opinionCategoryNames = map[string]string{
	"product":    "产品印象",
	"service":    "服务质量",
	"price":      "价格讨论",
	"competitor": "竞品对比",
	"other":      "其他声音",
	"suggestion": "改进建议",
}

// OpinionMaterialItem 舆情素材清单条目（周期内一条品牌/竞品提及事件）。
type OpinionMaterialItem struct {
	SiteName string `json:"site_name"`
	Question string `json:"question"`
	Text     string `json:"text"`
	Sentiment string `json:"sentiment"`
	EntityType string `json:"entity_type"`
	Rank     uint32 `json:"rank"`
}

// OpinionMaterial 周期舆情素材（供 LLM 总结）。
type OpinionMaterial struct {
	PeriodType string
	PeriodKey  string
	PeriodFrom time.Time
	PeriodTo   time.Time
	TotalValid int64            // 周期有效回答数
	TotalMention int64           // 周期品牌提及数（snapshot 去重）
	Items      []OpinionMaterialItem
	NegativeEvents []*biz.NegativeEvent // 负面事件明细
}

// opinionPeriodKey 计算周期标识：week → 2026-W35，month → 2026-08。
func opinionPeriodKey(periodType string, ref time.Time) string {
	d := ref.In(dashboardLoc)
	switch periodType {
	case "month":
		return d.Format("2006-01")
	default:
		y, w := d.ISOWeek()
		return fmt.Sprintf("%d-W%02d", y, w)
	}
}

// LoadOpinionMaterial 按周期捞舆情素材：品牌/企业/竞品提及 JOIN 回答快照。
func (r *brandBoardRepo) LoadOpinionMaterial(ctx context.Context, entID, brandID uint64, periodType string, ref time.Time) (*OpinionMaterial, error) {
	db := r.data.DB(ctx)
	from, to, _, _ := brandBoardPeriodRange(periodType, ref)
	mat := &OpinionMaterial{
		PeriodType: periodType,
		PeriodKey:  opinionPeriodKey(periodType, ref),
		PeriodFrom: from,
		PeriodTo:   to,
	}
	if err := db.Table(model.TableAnswerSnapshots+" AS s").
		Where("s.enterprise_id = ? AND s.answer_status = 'valid' AND s.observed_at >= ? AND s.observed_at < ?", entID, from, to).
		Count(&mat.TotalValid).Error; err != nil {
		return nil, err
	}
	if err := db.Table(model.TableMentions+" AS m").
		Joins("JOIN "+model.TableAnswerSnapshots+" AS s ON s.id = m.answer_snapshot_id").
		Where("s.enterprise_id = ? AND s.answer_status = 'valid' AND s.observed_at >= ? AND s.observed_at < ? AND "+brandMentionFilter, entID, from, to).
		Count(&mat.TotalMention).Error; err != nil {
		return nil, err
	}
	// 素材明细：品牌/企业/竞品提及（含上下文截断），按时间倒序最多 120 条。
	var rows []struct {
		SiteName   string `gorm:"column:site_name"`
		Question   string `gorm:"column:question"`
		Text       string `gorm:"column:text"`
		Sentiment  string `gorm:"column:sentiment"`
		EntityType string `gorm:"column:entity_type"`
		Rank       uint32 `gorm:"column:mention_rank"`
	}
	if err := db.Table(model.TableMentions+" AS m").
		Joins("JOIN "+model.TableAnswerSnapshots+" AS s ON s.id = m.answer_snapshot_id").
		Joins("JOIN "+model.TableInclusionSites+" AS site ON site.id = s.inclusion_site_id").
		Select("site.name AS site_name, s.question_text AS question, m.text AS text, COALESCE(m.sentiment, 'neutral') AS sentiment, m.entity_type AS entity_type, m.mention_rank AS 'rank'").
		Where("s.enterprise_id = ? AND s.answer_status = 'valid' AND s.observed_at >= ? AND s.observed_at < ? AND m.entity_type IN ('brand', 'enterprise', 'competitor')", entID, from, to).
		Order("s.observed_at DESC").
		Limit(120).
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	mat.Items = make([]OpinionMaterialItem, 0, len(rows))
	for _, row := range rows {
		mat.Items = append(mat.Items, OpinionMaterialItem{
			SiteName:   row.SiteName,
			Question:   truncateRunes(row.Question, 60),
			Text:       truncateRunes(row.Text, 200),
			Sentiment:  row.Sentiment,
			EntityType: row.EntityType,
			Rank:       row.Rank,
		})
	}

	// 加载负面事件明细：sentiment=negative 的 distinct snapshot 列表
	var negRows []struct {
		PlatformName string    `gorm:"column:platform_name"`
		Question     string    `gorm:"column:question"`
		AnswerText   string    `gorm:"column:answer_text"`
		SessionRef   string    `gorm:"column:session_ref"`
		ObservedAt   time.Time `gorm:"column:observed_at"`
	}
	if err := db.Table(model.TableMentions+" AS m").
		Joins("JOIN "+model.TableAnswerSnapshots+" AS s ON s.id = m.answer_snapshot_id").
		Joins("JOIN "+model.TableInclusionSites+" AS site ON site.id = s.inclusion_site_id").
		Select("site.name AS platform_name, s.question_text AS question, s.answer_text AS answer_text, s.session_ref AS session_ref, s.observed_at AS observed_at").
		Where("s.enterprise_id = ? AND s.answer_status = 'valid' AND s.observed_at >= ? AND s.observed_at < ? AND m.sentiment = 'negative' AND "+brandMentionFilter, entID, from, to).
		Group("s.id").
		Order("s.observed_at DESC").
		Limit(50).
		Scan(&negRows).Error; err != nil {
		return nil, err
	}
	mat.NegativeEvents = make([]*biz.NegativeEvent, 0, len(negRows))
	for _, nr := range negRows {
		observedAt := nr.ObservedAt
		mat.NegativeEvents = append(mat.NegativeEvents, &biz.NegativeEvent{
			Platform:      nr.PlatformName,
			Question:      truncateRunes(nr.Question, 100),
			AnswerPreview: truncateRunes(nr.AnswerText, 200),
			Sentiment:      "negative",
			ShareURL:       nr.SessionRef,
			ObservedAt:     &observedAt,
		})
	}

	return mat, nil
}

// resolveOpinionWritingModel 选择舆情总结用途（purpose=10）的活跃写作模型（按 sort_order 优先）。
func resolveOpinionWritingModel(db *gorm.DB) (*model.WritingModel, error) {
	var wm model.WritingModel
	err := db.Model(&model.WritingModel{}).
		Select(model.TableWritingModels+".*").
		Joins("JOIN "+model.TableWritingModelPurposes+" AS purpose ON purpose.writing_model_id = "+model.TableWritingModels+".id AND purpose.purpose = ?", model.WritingModelPurposeOpinionSummary).
		Where(model.TableWritingModels+".status = ?", model.WritingModelStatusActive).
		Where("EXISTS (SELECT 1 FROM "+model.TableWritingModelCredentials+" AS credential WHERE credential.writing_model_id = "+model.TableWritingModels+".id)").
		Order(model.TableWritingModels + ".sort_order ASC, " + model.TableWritingModels + ".id ASC").
		First(&wm).Error
	if err != nil {
		return nil, err
	}
	return &wm, nil
}

// enterpriseHasOpinionFeature 检查企业当前活跃订阅所属套餐是否启用"舆情分析"功能
// （feature=8）。查询路径：ent_subscriptions(active) → plan → ent_plan_features。
func enterpriseHasOpinionFeature(db *gorm.DB, enterpriseID uint64) bool {
	var count int64
	err := db.Table(model.TableSubscriptions+" AS sub").
		Joins("JOIN "+model.TablePlanFeatures+" AS pf ON pf.plan_id = sub.plan_id").
		Where("sub.enterprise_id = ? AND sub.status = ? AND sub.expires_at > NOW() AND pf.feature = ? AND pf.enabled = ?",
			enterpriseID, "active", model.PlanFeatureOpinionAnalysis, true).
		Count(&count).Error
	if err != nil {
		return false
	}
	return count > 0
}

// GenerateOpinionSummary 为一个 (企业, 品牌, 周期) 生成舆情总结并落库。
// 核心逻辑：只有检测到 negative sentiment 的 AI 回答时才生成舆情分析。
// 无负面时不生成（前端显示"暂无负面舆情"）。
// 幂等：唯一键冲突时跳过（已生成过）。
// 套餐门控：未启用"舆情分析"功能（feature=8）的企业不生成。
func (r *brandBoardRepo) GenerateOpinionSummary(ctx context.Context, entID, brandID uint64, periodType string, ref time.Time) error {
	db := r.data.DB(ctx)

	// 套餐功能门控：未开通舆情分析的企业直接跳过。
	if !enterpriseHasOpinionFeature(db, entID) {
		return nil
	}

	// 已生成过则跳过（唯一键幂等）。
	var existing int64
	if err := db.Model(&model.OpinionSummary{}).
		Where("enterprise_id = ? AND brand_id = ? AND period_type = ? AND period_key = ?", entID, brandID, periodType, opinionPeriodKey(periodType, ref)).
		Count(&existing).Error; err != nil {
		return err
	}
	if existing > 0 {
		return nil
	}

	mat, err := r.LoadOpinionMaterial(ctx, entID, brandID, periodType, ref)
	if err != nil {
		return err
	}
	// 舆情分析触发条件：只有本周/本月存在负面 mention 时才生成。
	// 无负面时不写占位行（让前端显示"暂无负面舆情"），下次调度可重新检查。
	if len(mat.NegativeEvents) == 0 {
		return nil
	}

	// 加载品牌画像作为 prompt 上下文。
	var brand model.Brand
	if err := db.Where("id = ?", brandID).First(&brand).Error; err != nil {
		return fmt.Errorf("load brand: %w", err)
	}

	wm, err := resolveOpinionWritingModel(db)
	if err != nil {
		return fmt.Errorf("resolve opinion writing model: %w", err)
	}
	var cred model.WritingModelCredential
	if err := db.Where("writing_model_id = ?", wm.ID).First(&cred).Error; err != nil {
		return fmt.Errorf("load writing model credential: %w", err)
	}
	apiKey, err := r.data.openCredential(cred.Nonce, cred.Ciphertext, []byte(fmt.Sprintf("writing-model:%d", wm.ID)))
	if err != nil {
		return fmt.Errorf("open credential: %w", err)
	}
	defer clear(apiKey)

	sections, err := generateOpinionSections(ctx, wm, brand, mat, string(apiKey))
	if err != nil {
		return err
	}
	return r.saveOpinionSections(ctx, entID, brandID, mat, wm.ID, sections)
}

type opinionSection struct {
	Category  string `json:"category"`
	Sentiment string `json:"sentiment"`
	Content   string `json:"content"`
}

// generateOpinionSections 调 LLM 一次生成全部分类叙述。
func generateOpinionSections(ctx context.Context, wm *model.WritingModel, brand model.Brand, mat *OpinionMaterial, apiKey string) ([]opinionSection, error) {
	if wm.Protocol != model.WritingModelProtocolOpenAICompatible {
		return nil, fmt.Errorf("unsupported writing model protocol %d", wm.Protocol)
	}
	timeout := time.Duration(wm.TimeoutSeconds) * time.Second
	if timeout <= 0 || timeout > 300*time.Second {
		timeout = 120 * time.Second
	}
	temperature := float32(wm.Temperature)
	topP := float32(wm.TopP)
	maxTokens := int(wm.MaxTokens)
	if maxTokens <= 0 || maxTokens > 16384 {
		maxTokens = 8192
	}
	chatModel, err := modelopenai.NewChatModel(ctx, &modelopenai.ChatModelConfig{
		APIKey: apiKey, Timeout: timeout, BaseURL: strings.TrimRight(wm.BaseURL, "/"), Model: wm.ModelID,
		Temperature: &temperature, TopP: &topP, MaxTokens: &maxTokens,
	})
	if err != nil {
		return nil, fmt.Errorf("create Eino chat model: %w", err)
	}
	system, userMsg := buildOpinionPrompt(brand, mat)
	response, err := chatModel.Generate(ctx, []*schema.Message{schema.SystemMessage(system), schema.UserMessage(userMsg)})
	if err != nil {
		return nil, fmt.Errorf("generate opinion summary: %w", err)
	}
	content := strings.TrimSpace(response.Content)
	if content == "" && strings.TrimSpace(response.ReasoningContent) != "" {
		content = strings.TrimSpace(response.ReasoningContent)
	}
	return parseOpinionSections(content)
}

func parseOpinionSections(content string) ([]opinionSection, error) {
	raw := strings.TrimSpace(content)
	if raw == "" {
		return nil, errors.New("opinion model returned empty content")
	}
	jsonContent := stripJSONFence(raw)
	var parsed struct {
		Sections []opinionSection `json:"sections"`
	}
	if err := json.Unmarshal([]byte(jsonContent), &parsed); err != nil {
		return nil, fmt.Errorf("parse opinion sections: %w", err)
	}
	valid := map[string]struct{}{}
	for _, cat := range opinionCategories {
		valid[cat] = struct{}{}
	}
	sentiments := map[string]struct{}{"positive": {}, "negative": {}, "neutral": {}}
	out := make([]opinionSection, 0, len(parsed.Sections))
	for _, s := range parsed.Sections {
		if _, ok := valid[s.Category]; !ok {
			continue
		}
		if _, ok := sentiments[s.Sentiment]; !ok {
			s.Sentiment = "neutral"
		}
		s.Content = strings.TrimSpace(s.Content)
		if s.Content == "" {
			continue
		}
		out = append(out, s)
	}
	if len(out) == 0 {
		return nil, errors.New("opinion sections empty after validation")
	}
	return out, nil
}

func buildOpinionPrompt(brand model.Brand, mat *OpinionMaterial) (system, user string) {
	var catDesc strings.Builder
	for _, cat := range opinionCategories {
		catDesc.WriteString("- " + cat + "（" + opinionCategoryNames[cat] + "）\n")
	}
	system = `你是 GEO 品牌舆情分析师。请基于给定的周期素材，输出各分类的舆情总结叙述。
要求：
1. 每段叙述必须引用素材中的具体事实（哪个平台、哪类问题、提及了什么），不得凭空编造。
2. 语气客观专业，像给品牌方的周报/月报，不是营销文案。
3. "suggestion" 分类输出 3 条以内可执行的 GEO 优化动作。
4. 素材不足的分类如实说明"本周期提及较少"，不要硬编。
5. 只输出 JSON，不要输出思考过程。
6. 不要在叙述中使用素材编号（如"素材1""素材1-18"等），直接用平台名和问题描述。

输出 JSON 格式：
{"sections": [{"category": "product", "sentiment": "positive", "content": "叙述段落"}, ...]}

category 取值：
` + catDesc.String() +
		`sentiment 取值：positive / negative / neutral`

	var items strings.Builder
	for i, item := range mat.Items {
		items.WriteString(fmt.Sprintf("%d. [%s|%s] 问题「%s」：%s\n", i+1, item.SiteName, item.Sentiment, item.Question, item.Text))
	}
	periodLabel := "本周"
	if mat.PeriodType == "month" {
		periodLabel = "本月"
	}
	brandDesc := brand.Description
	if len([]rune(brandDesc)) > 400 {
		brandDesc = truncateRunes(brandDesc, 400)
	}
	user = fmt.Sprintf(`品牌名称：%s
品牌简介：%s
行业：%s

周期：%s（%s 至 %s）
有效回答总数：%d
品牌提及总数：%d

素材清单（平台|情感|问题|提及内容）：
%s

请输出各分类的舆情总结 JSON。`, brand.Name, brandDesc, brand.Industry, periodLabel,
		mat.PeriodFrom.In(dashboardLoc).Format("2006-01-02"), mat.PeriodTo.In(dashboardLoc).Format("2006-01-02"),
		mat.TotalValid, mat.TotalMention, items.String())
	return system, user
}

// saveOpinionSections 落库（INSERT IGNORE，唯一键幂等）。
func (r *brandBoardRepo) saveOpinionSections(ctx context.Context, entID, brandID uint64, mat *OpinionMaterial, llmModelID uint64, sections []opinionSection) error {
	now := time.Now().UTC()
	rows := make([]model.OpinionSummary, 0, len(sections))
	for _, s := range sections {
		rows = append(rows, model.OpinionSummary{
			ImmutableTenantModel: model.ImmutableTenantModel{EnterpriseID: entID, CreatedAt: now},
			BrandID:              brandID,
			PeriodType:           mat.PeriodType,
			PeriodKey:            mat.PeriodKey,
			PeriodStart:          mat.PeriodFrom,
			PeriodEnd:            mat.PeriodTo,
			Category:             s.Category,
			Sentiment:            s.Sentiment,
			Content:              s.Content,
			MentionCount:         uint32(mat.TotalMention),
			LLMModelID:           &llmModelID,
			Status:               "completed",
			GeneratedAt:          now,
		})
	}
	return r.data.DB(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&rows).Error
}

// ListBrandsWithAnswers 找出近 40 天有有效回答的 (企业, 品牌) 组合（调度目标）。
// brand_id 在 geo_tasks 上（快照无 brand_id），经 geo_task_id 关联。
func (r *brandBoardRepo) ListBrandsWithAnswers(ctx context.Context) ([]biz.OpinionBrandTarget, error) {
	db := r.data.DB(ctx)
	since := time.Now().UTC().AddDate(0, 0, -40)
	var rows []struct {
		EnterpriseID uint64 `gorm:"column:enterprise_id"`
		BrandID      uint64 `gorm:"column:brand_id"`
	}
	if err := db.Table(model.TableAnswerSnapshots+" AS s").
		Joins("JOIN "+model.TableGEOTasks+" AS t ON t.id = s.geo_task_id").
		Joins("JOIN "+model.TableBrands+" AS b ON b.id = t.brand_id AND b.deleted_at IS NULL").
		Select("DISTINCT s.enterprise_id AS enterprise_id, t.brand_id AS brand_id").
		Where("s.answer_status = 'valid' AND s.observed_at >= ?", since).
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]biz.OpinionBrandTarget, 0, len(rows))
	for _, row := range rows {
		out = append(out, biz.OpinionBrandTarget{EnterpriseID: row.EnterpriseID, BrandID: row.BrandID})
	}
	return out, nil
}

// GetIndexBottom 舆情分析：读离线总结表（按 period 映射周期），并实时查询本周/本月负面事件明细。
// 无 LLM 总结时仍返回负面事件列表（让前端能看到最新负面回答）。
// req 无独立 period 字段，沿用 service 层约定：非 "month" 一律按 week。
func (r *brandBoardRepo) GetIndexBottom(ctx context.Context, entID uint64, period string) (*biz.BrandIndexBottom, error) {
	db := r.data.DB(ctx)
	if period != "month" {
		period = "week"
	}
	now := time.Now().In(dashboardLoc)
	from, to, _, _ := brandBoardPeriodRange(period, now)

	// 1. 读取 LLM 生成的舆情总结（geo_opinion_summaries）
	// 过滤历史占位行（重构前 saveOpinionPlaceholders 写入的"未生成舆情分析"占位文案），
	// 避免与负面事件列表同时渲染造成文案错乱。
	var rows []model.OpinionSummary
	if err := db.Where("enterprise_id = ? AND period_type = ? AND period_key = ? AND status = 'completed' AND content NOT LIKE '%未生成舆情分析%'", entID, period, opinionPeriodKey(period, now)).
		Order("FIELD(category, 'product', 'service', 'price', 'competitor', 'other', 'suggestion')").
		Find(&rows).Error; err != nil {
		return nil, err
	}
	out := &biz.BrandIndexBottom{PeriodType: period, Opinions: []*biz.BrandOpinion{}, NegativeEvents: []*biz.NegativeEvent{}}
	for _, row := range rows {
		title := opinionCategoryNames[row.Category]
		if title == "" {
			title = row.Category
		}
		out.Opinions = append(out.Opinions, &biz.BrandOpinion{
			Title:     title,
			Summary:   row.Content,
			Sentiment: row.Sentiment,
			OccurredAt: func() *time.Time {
				t := row.GeneratedAt
				return &t
			}(),
		})
	}

	// 2. 实时查询本周/本月负面事件明细（sentiment=negative 的 distinct snapshot）
	var negRows []struct {
		PlatformName string    `gorm:"column:platform_name"`
		Question     string    `gorm:"column:question"`
		AnswerText   string    `gorm:"column:answer_text"`
		SessionRef   string    `gorm:"column:session_ref"`
		ObservedAt   time.Time `gorm:"column:observed_at"`
	}
	if err := db.Table(model.TableMentions+" AS m").
		Joins("JOIN "+model.TableAnswerSnapshots+" AS s ON s.id = m.answer_snapshot_id").
		Joins("JOIN "+model.TableInclusionSites+" AS site ON site.id = s.inclusion_site_id").
		Select("site.name AS platform_name, s.question_text AS question, s.answer_text AS answer_text, s.session_ref AS session_ref, s.observed_at AS observed_at").
		Where("s.enterprise_id = ? AND s.answer_status = 'valid' AND s.observed_at >= ? AND s.observed_at < ? AND m.sentiment = 'negative' AND "+brandMentionFilter, entID, from, to).
		Group("s.id").
		Order("s.observed_at DESC").
		Limit(50).
		Scan(&negRows).Error; err != nil {
		return nil, err
	}
	for _, nr := range negRows {
		observedAt := nr.ObservedAt
		out.NegativeEvents = append(out.NegativeEvents, &biz.NegativeEvent{
			Platform:      nr.PlatformName,
			Question:      truncateRunes(nr.Question, 100),
			AnswerPreview: truncateRunes(nr.AnswerText, 200),
			Sentiment:      "negative",
			ShareURL:       nr.SessionRef,
			ObservedAt:     &observedAt,
		})
	}

	return out, nil
}
