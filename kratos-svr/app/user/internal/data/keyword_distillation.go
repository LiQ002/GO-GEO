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

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type keywordDistillationRepo struct {
	data *Data
}

func NewKeywordDistillationRepo(data *Data) biz.KeywordDistillationRepo {
	return &keywordDistillationRepo{data: data}
}

func (r *keywordDistillationRepo) Create(ctx context.Context, input biz.KeywordDistillationInput) (*biz.KeywordDistillationTask, bool, error) {
	var task model.KeywordDistillationTask
	created := false
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		if err := tx.Where("enterprise_id = ? AND client_request_id = ?", input.EnterpriseID, strings.TrimSpace(input.ClientRequestID)).First(&task).Error; err == nil {
			return nil
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		var keyword model.Keyword
		if err := tx.Where("enterprise_id = ? AND id = ?", input.EnterpriseID, input.KeywordID).First(&keyword).Error; err != nil {
			return mapKeywordError(err)
		}
		var brand model.Brand
		if err := tx.Select("id", "name").Where("enterprise_id = ? AND id = ?", input.EnterpriseID, keyword.BrandID).First(&brand).Error; err != nil {
			return mapBrandError(err)
		}
		writingModel, err := resolveDistillationWritingModel(tx, input.EnterpriseID, input.WritingModelID)
		if err != nil {
			return err
		}
		region := strings.TrimSpace(input.Region)
		if region == "" {
			region = strings.TrimSpace(keyword.Region)
		}
		prompt, err := buildKeywordDistillationPrompt(keyword.Text, brand.Name, region, input.QuestionCount)
		if err != nil {
			return err
		}
		promptJSON, err := json.Marshal(prompt)
		if err != nil {
			return err
		}
		modelJSON, err := json.Marshal(generationModelSnapshot{
			Provider: writingModelProviderCode(writingModel.Provider), Protocol: writingModelProtocolCode(writingModel.Protocol), BaseURL: writingModel.BaseURL,
			ModelID: writingModel.ModelID, Temperature: writingModel.Temperature, TopP: writingModel.TopP,
			MaxTokens: writingModel.MaxTokens, TimeoutSeconds: writingModel.TimeoutSeconds,
			InputPriceMicrosPerMillionTokens:  writingModel.InputPriceMicrosPerMillionTokens,
			OutputPriceMicrosPerMillionTokens: writingModel.OutputPriceMicrosPerMillionTokens,
			PriceCurrency:                     priceCurrencyCode(writingModel.PriceCurrency), Version: writingModel.Version,
		})
		if err != nil {
			return err
		}
		task = model.KeywordDistillationTask{
			TenantModel: model.TenantModel{EnterpriseID: input.EnterpriseID},
			KeywordID:   keyword.ID, BrandID: keyword.BrandID,
			WritingModelID: writingModel.ID, WritingModelVersion: writingModel.Version,
			ClientRequestID: strings.TrimSpace(input.ClientRequestID), Status: biz.KeywordDistillationStatusPending,
			Region: region, RequestedCount: input.QuestionCount, PromptSnapshot: string(promptJSON), ModelSnapshotJSON: modelJSON,
		}
		if err := tx.Create(&task).Error; err != nil {
			if errors.Is(err, gorm.ErrDuplicatedKey) {
				return tx.Where("enterprise_id = ? AND client_request_id = ?", input.EnterpriseID, strings.TrimSpace(input.ClientRequestID)).First(&task).Error
			}
			return err
		}
		if err := tx.Model(&keyword).Updates(map[string]any{
			"region":                    region,
			"requested_question_count":  input.QuestionCount,
			"distillation_status":       biz.KeywordDistillationStatusPending,
			"last_distillation_task_id": task.ID,
			"distillation_error":        "",
			"version":                   gorm.Expr("version + 1"),
		}).Error; err != nil {
			return err
		}
		// 计费：双账本预扣 ai_distills（额度优先，额度用尽自动转点数扣减）。
		idemKey := "keyword-distillation:" + strings.TrimSpace(input.ClientRequestID)
		if _, err := reserveBilling(tx, input.EnterpriseID, "ai_distill", 1, "keyword_distillation", task.ID, idemKey, "keyword distillation created"); err != nil {
			return err
		}
		// 词条数（article_generations）配额预扣：蒸馏会产出 input.QuestionCount 条问题，
		// 必须提前校验避免超限（前端"套餐用量-词条数"对应此 metric）。
		// 任务完成时按实际入库数 settle，失败时 release 全部预扣。
		if err := reserveQuota(tx, input.EnterpriseID, "article_generations", int64(input.QuestionCount)); err != nil {
			// 转换错误：reserveQuota 内部用 ErrPublishQuota（reason code 是 PUBLISH_QUOTA_EXCEEDED），
			// 在词条数场景下应该用 ErrArticleGenerationsQuotaExceeded，文案提示"管理词条"更具体可操作。
			if errors.Is(err, biz.ErrPublishQuota) {
				return biz.ErrArticleGenerationsQuotaExceeded
			}
			return err
		}
		created = true
		return nil
	})
	if err != nil {
		return nil, false, mapKeywordDistillationError(err)
	}
	return keywordDistillationDO(&task), created, nil
}

func (r *keywordDistillationRepo) Get(ctx context.Context, enterpriseID, id uint64) (*biz.KeywordDistillationTask, error) {
	var task model.KeywordDistillationTask
	if err := r.data.DB(ctx).Where("enterprise_id = ? AND id = ?", enterpriseID, id).First(&task).Error; err != nil {
		return nil, mapKeywordDistillationError(err)
	}
	return keywordDistillationDO(&task), nil
}

func (r *keywordDistillationRepo) List(ctx context.Context, enterpriseID uint64, opts biz.KeywordDistillationListOptions) ([]*biz.KeywordDistillationTask, int64, error) {
	db := r.data.DB(ctx).Model(&model.KeywordDistillationTask{}).Where("enterprise_id = ?", enterpriseID)
	if opts.KeywordID != 0 {
		db = db.Where("keyword_id = ?", opts.KeywordID)
	}
	if opts.Status != 0 {
		db = db.Where("status = ?", opts.Status)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []model.KeywordDistillationTask
	if err := db.Order("created_at DESC, id DESC").Offset(opts.Offset).Limit(opts.Limit).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	items := make([]*biz.KeywordDistillationTask, 0, len(rows))
	for i := range rows {
		items = append(items, keywordDistillationDO(&rows[i]))
	}
	return items, total, nil
}

func (r *keywordDistillationRepo) Start(ctx context.Context, enterpriseID, id uint64, retry bool) (*biz.KeywordDistillationTask, error) {
	expected := biz.KeywordDistillationStatusPending
	if retry {
		expected = biz.KeywordDistillationStatusFailed
	}
	now := time.Now().UTC()
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var task model.KeywordDistillationTask
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("enterprise_id = ? AND id = ? AND status = ?", enterpriseID, id, expected).First(&task).Error; err != nil {
			return err
		}
		if err := tx.Model(&task).Updates(map[string]any{
			"status": biz.KeywordDistillationStatusRunning, "started_at": now, "completed_at": nil,
			"error_code": "", "error_message": "", "attempt_count": gorm.Expr("attempt_count + 1"),
		}).Error; err != nil {
			return err
		}
		return tx.Model(&model.Keyword{}).Where("enterprise_id = ? AND id = ?", enterpriseID, task.KeywordID).Updates(map[string]any{
			"distillation_status": biz.KeywordDistillationStatusRunning, "distillation_error": "", "version": gorm.Expr("version + 1"),
		}).Error
	})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, biz.ErrKeywordDistillationState
		}
		return nil, mapKeywordDistillationError(err)
	}
	return r.Get(ctx, enterpriseID, id)
}

func (r *keywordDistillationRepo) Complete(ctx context.Context, task *biz.KeywordDistillationTask, result *biz.KeywordDistillationResult) (*biz.KeywordDistillationTask, error) {
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var current model.KeywordDistillationTask
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("enterprise_id = ? AND id = ? AND status = ?", task.EnterpriseID, task.ID, biz.KeywordDistillationStatusRunning).First(&current).Error; err != nil {
			return err
		}
		// 清理该 keyword 下旧的蒸馏问题（同 keyword_id + source=distilled），
		// 避免历史任务残留导致数据膨胀和统计不一致。
		if err := tx.Where("enterprise_id = ? AND keyword_id = ? AND source = ?", current.EnterpriseID, current.KeywordID, biz.QuestionSourceDistilled).
			Delete(&model.Question{}).Error; err != nil {
			return err
		}
		questions := make([]model.Question, 0, len(result.Questions))
		for index, item := range result.Questions {
			questions = append(questions, newDistilledQuestion(&current, index, item))
		}
		if err := tx.Create(&questions).Error; err != nil {
			return err
		}
		// 统计实际入库的问题数（以数据库为准，而非 result.Questions 长度），
		// 避免因部分插入失败或约束冲突导致主表计数与实际不一致。
		var actualCount int64
		if err := tx.Model(&model.Question{}).
			Where("enterprise_id = ? AND keyword_id = ? AND source = ? AND distillation_task_id = ?",
				current.EnterpriseID, current.KeywordID, biz.QuestionSourceDistilled, current.ID).
			Count(&actualCount).Error; err != nil {
			return err
		}
		outputJSON, err := json.Marshal(result)
		if err != nil {
			return err
		}
		now := time.Now().UTC()
		if err := tx.Model(&current).Updates(map[string]any{
			"status": biz.KeywordDistillationStatusCompleted, "output_json": outputJSON,
			"input_tokens": result.InputTokens, "output_tokens": result.OutputTokens, "cost_micros": result.CostMicros,
			"completed_at": now,
		}).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.Keyword{}).Where("enterprise_id = ? AND id = ?", current.EnterpriseID, current.KeywordID).Updates(map[string]any{
			"distilled_question_count": actualCount, "distillation_status": biz.KeywordDistillationStatusCompleted,
			"distillation_error": "", "last_distillation_task_id": current.ID, "version": gorm.Expr("version + 1"),
		}).Error; err != nil {
			return err
		}
		// 计费：任务成功，结算预扣 ai_distills（额度或点数，由 settleBillingByRef 自动判断）。
		settleKey := fmt.Sprintf("keyword-distillation-settle:%d", current.ID)
		if err := settleBillingByRef(tx, current.EnterpriseID, "ai_distills", 1, "keyword_distillation", current.ID, settleKey); err != nil {
			return err
		}
		// 词条数（article_generations）结算：按实际入库的问题数 settle 预扣，
		// 多余的预扣（请求量 > 实际产出）通过 release 归还。
		// 实际产出 ≤ 请求量的情况下：settle(actualCount) + release(requestedCount - actualCount)
		// 实际产出 > 请求量（罕见，但 LLM 偶发 over-generation）：仅 settle(requestedCount)，
		// 避免越界扣减 reserved_value。差额在下次 backfillQuotaUsedValue 时自动同步。
		requestedCount := int64(current.RequestedCount)
		settleAmount := actualCount
		if settleAmount > requestedCount {
			settleAmount = requestedCount
		}
		articleSettleKey := fmt.Sprintf("keyword-distillation-article-generations-settle:%d", current.ID)
		if err := settleQuota(tx, current.EnterpriseID, "article_generations", settleAmount, "keyword_distillation", current.ID, articleSettleKey); err != nil {
			return err
		}
		// 归还多余的预扣（请求量 - 实际入库数），仅当实际产出 < 请求量时。
		if releaseAmount := requestedCount - actualCount; releaseAmount > 0 {
			articleReleaseKey := fmt.Sprintf("keyword-distillation-article-generations-release:%d", current.ID)
			if err := releaseQuota(tx, current.EnterpriseID, "article_generations", releaseAmount, "keyword_distillation", current.ID, articleReleaseKey); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, mapKeywordDistillationError(err)
	}
	return r.Get(ctx, task.EnterpriseID, task.ID)
}

func newDistilledQuestion(task *model.KeywordDistillationTask, index int, item biz.DistilledQuestion) model.Question {
	taskID := task.ID
	return model.Question{
		TenantModel:        model.TenantModel{EnterpriseID: task.EnterpriseID},
		KeywordID:          task.KeywordID,
		BrandID:            task.BrandID,
		Text:               item.Text,
		Region:             task.Region,
		Source:             biz.QuestionSourceDistilled,
		DistillationTaskID: &taskID,
		Status:             biz.QuestionStatusPending,
		Intent:             item.Intent,
		Audience:           item.Audience,
		FunnelStage:        item.FunnelStage,
		SortOrder:          int32(index + 1),
		Version:            1,
	}
}

func (r *keywordDistillationRepo) Fail(ctx context.Context, enterpriseID, id uint64, code, message string) (*biz.KeywordDistillationTask, error) {
	now := time.Now().UTC()
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var task model.KeywordDistillationTask
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("enterprise_id = ? AND id = ? AND status = ?", enterpriseID, id, biz.KeywordDistillationStatusRunning).First(&task).Error; err != nil {
			return err
		}
		if err := tx.Model(&task).Updates(map[string]any{
			"status": biz.KeywordDistillationStatusFailed, "error_code": code, "error_message": message, "completed_at": now,
		}).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.Keyword{}).Where("enterprise_id = ? AND id = ?", enterpriseID, task.KeywordID).Updates(map[string]any{
			"distillation_status": biz.KeywordDistillationStatusFailed, "distillation_error": message,
			"last_distillation_task_id": task.ID, "version": gorm.Expr("version + 1"),
		}).Error; err != nil {
			return err
		}
		// 计费：任务失败，回滚预扣 ai_distills（额度或点数，由 rollbackBillingByRef 自动判断）。
		rollbackKey := fmt.Sprintf("keyword-distillation-rollback:%d", id)
		if err := rollbackBillingByRef(tx, enterpriseID, "ai_distills", 1, "keyword_distillation", id, rollbackKey); err != nil {
			return err
		}
		// 词条数（article_generations）回滚：蒸馏失败时不产出问题，全部预扣需归还。
		// 用 task.RequestedCount 作为归还量（与 Create 时预扣的数量一致）。
		articleReleaseKey := fmt.Sprintf("keyword-distillation-article-generations-rollback:%d", id)
		return releaseQuota(tx, enterpriseID, "article_generations", int64(task.RequestedCount), "keyword_distillation", id, articleReleaseKey)
	})
	if err != nil {
		return nil, mapKeywordDistillationError(err)
	}
	return r.Get(ctx, enterpriseID, id)
}

func resolveDistillationWritingModel(tx *gorm.DB, enterpriseID, requestedID uint64) (*model.WritingModel, error) {
	var item model.WritingModel
	query := tx.Model(&model.WritingModel{}).
		Select(model.TableWritingModels+".*").
		Joins("JOIN "+model.TableWritingModelPurposes+" AS purpose ON purpose.writing_model_id = "+model.TableWritingModels+".id AND purpose.purpose = ?", model.WritingModelPurposeQuestionExtraction).
		Where(model.TableWritingModels+".status = ?", model.WritingModelStatusActive).
		Where(writingModelAccessSQL, writingModelAccessArgs(enterpriseID)...).
		Where("EXISTS (SELECT 1 FROM " + model.TableWritingModelCredentials + " AS credential WHERE credential.writing_model_id = " + model.TableWritingModels + ".id)")
	if requestedID != 0 {
		query = query.Where(model.TableWritingModels+".id = ?", requestedID)
	}
	if err := query.Order(model.TableWritingModels + ".sort_order ASC, " + model.TableWritingModels + ".id ASC").First(&item).Error; err != nil {
		return nil, biz.ErrKeywordDistillationModel
	}
	return &item, nil
}

// keywordDistillationOverGenerationFactor 是请求大模型时相对用户请求量的超额系数。
// LLM 产出会有重复、非问句、纯科普等无效问题被本地过滤，预留 50% 余量确保单轮过滤后仍够数。
// 配合紧凑 JSON 输出，8192 max_tokens 足以覆盖 75 条问题的输出。
const keywordDistillationOverGenerationFactor = 1.5

// keywordDistillationMaxRounds 固定为 1：单轮一次性生成，不做回填循环。
// 过滤后不足 85% 则判失败，用户可手动重试。
const keywordDistillationMaxRounds = 1

func buildKeywordDistillationPrompt(keyword, brand, region string, count uint32) (generationPromptSnapshot, error) {
	keyword = strings.TrimSpace(keyword)
	brand = strings.TrimSpace(brand)
	region = strings.TrimSpace(region)

	// 五类问题分配（聚焦 GEO 品牌提及场景）。
	// 决策引导 + 对比评测 + 口碑评价 合计约 60%，是 GEO 最有价值的问题：
	// 用户向 AI 提这类问题时，AI 的回答会点名提及品牌/产品/服务。
	// 不再保留"产品知识"纯科普类（如"矿泉水含有什么矿物质"），因为 AI 回答只讲知识点、不点名品牌。
	allocations := computeQuestionAllocations(count, brand)

	// 区域智能混合：有区域时约 60% 不限区域 + 40% 带区域；无区域则全部不限区域。
	regionRule := "不要强行加入地域限定"
	if region != "" {
		regionRule = fmt.Sprintf("约 60%% 的问题不限区域，约 40%% 的问题须自然体现区域“%s”的真实搜索语境", region)
	}

	system := `你是 GEO 搜索问题蒸馏专家。请根据给定的关键词、品牌和可选区域，生成用户会向大模型或搜索引擎提出的真实自然问题。
GEO 关键词蒸馏的本质：用户向 AI 提这类问题时，AI 的回答会点名提及品牌、公司、产品或服务。
因此只生成"能触发 AI 品牌提及"的问题，不要生成纯科普/纯知识类问题（如"矿泉水含有什么成分""矿泉水是怎么生产的"），这类问题 AI 回答时只会讲知识点，不会点名品牌，对 GEO 优化没有价值。

【重要】生成的问题文本中严禁包含品牌名！品牌名仅作为蒸馏的参考上下文，绝不能出现在生成的问题中。
例如：品牌是"百岁山"，则问题中不能出现"百岁山"字样。
错误示例（禁止）："百岁山矿泉水怎么样""百岁山是哪个国家的品牌""百岁山矿泉水有什么特点"
正确示例："矿泉水品牌怎么样""矿泉水有哪些品牌""矿泉水什么牌子好"

问题必须覆盖以下 5 类（每类数量由用户指定），每类都要口语化、符合真实搜索习惯，且不得包含品牌名：
1. 品牌认知：了解品类背景、定位、口碑（如"矿泉水品牌怎么样""矿泉水有哪些品牌""矿泉水品牌排名"）。
2. 场景推荐：特定使用场景下向 AI 求推荐，必须带"推荐/求推荐/哪家好/哪个好"等词尾，让 AI 回答时点名品牌（如"运动后喝什么水好求推荐""家用矿泉水推荐哪种"）。
3. 对比评测：产品对比、性价比对比、品牌排名（如"矿泉水和纯净水哪个好""矿泉水品牌排名前十""天然水和矿泉水的差别"）。
4. 决策引导：直接向 AI 要推荐/排行/哪家好（必须包含"推荐""排行""排名""哪家好""哪个牌子好""求推荐""十大品牌"等词）。
5. 口碑评价：真实体验/评价（如"矿泉水用户评价怎么样""矿泉水值得买吗""矿泉水口碑如何"）。

硬性规则：
1. 生成用户指定总数，不得少生成。每类数量必须满足分配要求。
2. 问题必须是真实中文搜索/提问，覆盖不同用户意图与漏斗阶段，不得只是关键词堆砌。
3. 优先生成比较类、推荐类、排行类、场景推荐类问题。
4. 不得生成纯科普/纯知识类问题（如"矿泉水是什么""矿泉水含有什么""矿泉水能放多久"），这类问题 AI 回答不会点名品牌。
5. 不得重复，不得预设或编造未经提供的事实、产品功效或口碑。
6. 漏斗阶段合理分布：认知阶段约 30%，考虑阶段约 40%，决策阶段约 30%。
7. 只输出合法 JSON，不要输出 Markdown 代码块、解释或注释。
8. JSON 必须紧凑：不换行、不缩进、不加多余空格，audience 字段简短（2-6 字）。
9. 【最严格规则】生成的问题文本中绝对禁止出现任何品牌名！品牌名只能作为内部参考，不能出现在最终输出的问题中。
   正确示例：{"questions":[{"text":"矿泉水哪个牌子好求推荐","intent":4,"audience":"决策者","funnel_stage":3}]}
   错误示例（禁止）：{"questions":[{"text":"百岁山矿泉水怎么样","intent":2,"audience":"消费者","funnel_stage":1}]}
   错误示例（禁止）：带换行缩进的多行 JSON。
intent 只能是数字：1科普、2调研、3比较、4购买；funnel_stage 只能是数字：1认知、2考虑、3决策。`

	user := fmt.Sprintf(`关键词：%s
品牌：%s
区域：%s
请生成 %d 个不重复的问题，按以下分类和数量分配：
%s
%s。

示例（紧凑 JSON，请严格按此格式输出）：
{"questions":[{"text":"矿泉水哪个牌子好求推荐","intent":4,"audience":"决策者","funnel_stage":3},{"text":"农夫山泉和怡宝哪个好","intent":3,"audience":"消费者","funnel_stage":2},{"text":"运动后喝什么水好求推荐","intent":4,"audience":"运动者","funnel_stage":3}]}`, keyword, brandOrPlaceholder(brand), regionOrPlaceholder(region), count, allocations.String(), regionRule)
	return generationPromptSnapshot{System: system, User: user, Brand: brand}, nil
}

// questionAllocation 记录每类问题的数量分配（聚焦 GEO 品牌提及场景，5 类）。
type questionAllocation struct {
	BrandAwareness   uint32 // 品牌认知
	ScenarioDemand   uint32 // 场景推荐（强制带品牌提及词尾）
	ComparisonReview uint32 // 对比评测
	DecisionGuidance uint32 // 决策引导
	WordOfMouth      uint32 // 口碑评价
}

func (a questionAllocation) String() string {
	return fmt.Sprintf(`- 品牌认知：%d 个
- 场景推荐：%d 个（必须带"推荐/求推荐/哪家好/哪个好"等词尾，触发 AI 品牌提及）
- 对比评测：%d 个
- 决策引导：%d 个（必须包含"推荐/排行/排名/哪家好/哪个牌子好/求推荐/十大品牌"等关键词）
- 口碑评价：%d 个`,
		a.BrandAwareness, a.ScenarioDemand,
		a.ComparisonReview, a.DecisionGuidance, a.WordOfMouth)
}

// computeQuestionAllocations 按通用 GEO 框架分配问题数量（5 类，聚焦品牌提及场景）。
// 决策引导 + 对比评测 + 口碑评价 合计约 60%，是 GEO 最有价值的问题。
func computeQuestionAllocations(count uint32, brand string) questionAllocation {
	hasBrand := strings.TrimSpace(brand) != ""
	if count == 0 {
		return questionAllocation{}
	}

	// 小数量时优先保证核心类别（决策引导、场景推荐、对比评测）。
	if count < 6 {
		alloc := questionAllocation{DecisionGuidance: 1}
		remaining := count - 1
		if remaining > 0 {
			alloc.ScenarioDemand = 1
			remaining--
		}
		if remaining > 0 {
			alloc.ComparisonReview = 1
			remaining--
		}
		if remaining > 0 && hasBrand {
			alloc.BrandAwareness = 1
			remaining--
		}
		if remaining > 0 && hasBrand {
			alloc.WordOfMouth = 1
			remaining--
		}
		if remaining > 0 {
			alloc.DecisionGuidance += remaining
		}
		return alloc
	}

	// 通用比例（无品牌时，品牌认知和口碑评价合并到场景推荐和决策引导）。
	raw := questionAllocation{
		BrandAwareness:   max(uint32(float64(count)*0.20), 1),
		ScenarioDemand:   max(uint32(float64(count)*0.16), 1),
		ComparisonReview: max(uint32(float64(count)*0.24), 1),
		DecisionGuidance: max(uint32(float64(count)*0.24), 1),
		WordOfMouth:      max(uint32(float64(count)*0.16), 1),
	}
	if !hasBrand {
		raw.BrandAwareness = 0
		raw.WordOfMouth = 0
		raw.ScenarioDemand += max(uint32(float64(count)*0.20), 1)
		raw.DecisionGuidance += max(uint32(float64(count)*0.16), 1)
	}

	// 保证总数精确等于 count。
	total := raw.BrandAwareness + raw.ScenarioDemand +
		raw.ComparisonReview + raw.DecisionGuidance + raw.WordOfMouth
	// 超过时从占比大的类别逐减，且保证每类至少有 0 个（有品牌的保留至少 1 个）。
	for total > count {
		reduced := false
		switch {
		case raw.DecisionGuidance > 1 && total > count:
			raw.DecisionGuidance--
			reduced = true
		case raw.ComparisonReview > 1 && total > count:
			raw.ComparisonReview--
			reduced = true
		case raw.ScenarioDemand > 1 && total > count:
			raw.ScenarioDemand--
			reduced = true
		case raw.BrandAwareness > 1 && total > count:
			raw.BrandAwareness--
			reduced = true
		case raw.WordOfMouth > 1 && total > count:
			raw.WordOfMouth--
			reduced = true
		}
		if !reduced {
			break
		}
		total = raw.BrandAwareness + raw.ScenarioDemand +
			raw.ComparisonReview + raw.DecisionGuidance + raw.WordOfMouth
	}
	// 不足时优先补充决策引导类。
	for total < count {
		raw.DecisionGuidance++
		total++
	}
	return raw
}

func brandOrPlaceholder(brand string) string {
	if brand == "" {
		return "未提供"
	}
	return brand
}

func regionOrPlaceholder(region string) string {
	if region == "" {
		return "不限"
	}
	return region
}

func keywordDistillationDO(item *model.KeywordDistillationTask) *biz.KeywordDistillationTask {
	if item == nil {
		return nil
	}
	return &biz.KeywordDistillationTask{
		ID: item.ID, EnterpriseID: item.EnterpriseID, KeywordID: item.KeywordID, BrandID: item.BrandID,
		WritingModelID: item.WritingModelID, WritingModelVersion: item.WritingModelVersion,
		ClientRequestID: item.ClientRequestID, Status: item.Status, Region: item.Region, RequestedCount: item.RequestedCount,
		PromptSnapshot: item.PromptSnapshot, ModelSnapshotJSON: string(item.ModelSnapshotJSON), OutputJSON: string(item.OutputJSON),
		InputTokens: item.InputTokens, OutputTokens: item.OutputTokens, CostMicros: item.CostMicros,
		ErrorCode: item.ErrorCode, ErrorMessage: item.ErrorMessage, AttemptCount: item.AttemptCount,
		StartedAt: item.StartedAt, CompletedAt: item.CompletedAt, CreatedAt: item.CreatedAt, UpdatedAt: item.UpdatedAt,
	}
}

func mapKeywordDistillationError(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return biz.ErrKeywordDistillationNotFound
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return biz.ErrKeywordDistillationState
	}
	return err
}
