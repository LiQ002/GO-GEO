package data

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/data/model"

	"gorm.io/gorm"
)

const diagnosisReportExcerptLimit = 1200

func replaceSalesDiagnosisReport(tx *gorm.DB, diagnosis *model.SalesDiagnosis, status int32, succeeded, failed int64) error {
	if diagnosis == nil {
		return biz.ErrSalesDiagnosisInvalid
	}
	if err := tx.Model(&model.SalesDiagnosisReport{}).Where("diagnosis_id = ? AND is_current = TRUE", diagnosis.ID).Update("is_current", false).Error; err != nil {
		return err
	}
	var maxVersion uint64
	if err := tx.Model(&model.SalesDiagnosisReport{}).Where("diagnosis_id = ?", diagnosis.ID).Select("COALESCE(MAX(version), 0)").Scan(&maxVersion).Error; err != nil {
		return err
	}
	var profile model.SalesDiagnosisProfile
	if err := tx.Where("diagnosis_id = ?", diagnosis.ID).First(&profile).Error; err != nil {
		return err
	}
	var preparationAttempt model.SalesDiagnosisPreparationAttempt
	if err := tx.Raw(`
		SELECT a.*
		FROM sls_diagnosis_preparation_attempts a
		JOIN sls_diagnosis_preparations p ON p.id = a.preparation_id
		WHERE p.diagnosis_id = ? AND a.succeeded = TRUE
		ORDER BY a.attempt_no DESC
		LIMIT 1`, diagnosis.ID).Scan(&preparationAttempt).Error; err != nil {
		return err
	}
	var diagnosisModels []model.SalesDiagnosisModel
	if err := tx.Where("diagnosis_id = ?", diagnosis.ID).Order("sort_order, id").Find(&diagnosisModels).Error; err != nil {
		return err
	}
	var questions []model.SalesDiagnosisQuestion
	if err := tx.Where("diagnosis_id = ?", diagnosis.ID).Order("sort_order, id").Find(&questions).Error; err != nil {
		return err
	}
	var tasks []model.SalesDiagnosisTask
	if err := tx.Where("diagnosis_id = ?", diagnosis.ID).Order("id").Find(&tasks).Error; err != nil {
		return err
	}
	taskIDs := make([]uint64, 0, len(tasks))
	for _, task := range tasks {
		taskIDs = append(taskIDs, task.ID)
	}
	var results []model.SalesDiagnosisResult
	if len(taskIDs) > 0 {
		if err := tx.Raw(`
			SELECT r.*
			FROM sls_diagnosis_results r
			JOIN sls_diagnosis_tasks t ON t.id = r.task_id AND t.attempt_count = r.attempt_no
			WHERE t.diagnosis_id = ?`, diagnosis.ID).Scan(&results).Error; err != nil {
			return err
		}
	}
	resultByTask := make(map[uint64]model.SalesDiagnosisResult, len(results))
	resultIDs := make([]uint64, 0, len(results))
	for _, result := range results {
		resultByTask[result.TaskID] = result
		resultIDs = append(resultIDs, result.ID)
	}
	competitorCounts := make(map[uint64]int64, len(resultIDs))
	if len(resultIDs) > 0 {
		var counts []struct {
			ResultID uint64
			Count    int64
		}
		if err := tx.Model(&model.SalesDiagnosisCompetitorMention{}).
			Select("result_id, COUNT(*) AS count").Where("result_id IN ?", resultIDs).
			Group("result_id").Scan(&counts).Error; err != nil {
			return err
		}
		for _, count := range counts {
			competitorCounts[count.ResultID] = count.Count
		}
	}
	var metrics []model.SalesDiagnosisMetric
	if err := tx.Where("diagnosis_id = ? AND is_current = TRUE", diagnosis.ID).Find(&metrics).Error; err != nil {
		return err
	}
	metricValues := make(map[string]model.SalesDiagnosisMetric, len(metrics))
	for _, metric := range metrics {
		modelID := uint64(0)
		if metric.ModelID != nil {
			modelID = *metric.ModelID
		}
		metricValues[diagnosisReportMetricKey(modelID, metric.MetricCode)] = metric
	}
	brandRate := diagnosisReportMetricValue(metricValues, 0, "brand_mention_rate")
	citationRate := diagnosisReportMetricValue(metricValues, 0, "citation_rate")
	shareOfVoice := diagnosisReportMetricValue(metricValues, 0, "brand_share_of_voice")
	mentionCount := diagnosisReportMetricValue(metricValues, 0, "brand_mention_count")
	top3Rate := diagnosisReportMetricValue(metricValues, 0, "top3_rate")
	contentAdoptionRate := diagnosisReportMetricValue(metricValues, 0, "content_adoption_rate")
	now := time.Now().UTC()
	report := &model.SalesDiagnosisReport{
		DiagnosisID: diagnosis.ID, Status: model.SalesDiagnosisReportStatusReady,
		TemplateCode: "sales_diagnosis_v4", TemplateVersion: 4,
		Title: fmt.Sprintf("%s GEO（生成式引擎优化）售前诊断报告", profile.BrandName),
		ExecutiveSummary: fmt.Sprintf(
			"%s本次基于 %d 个诊断问题和 %d 个 AI 平台模型的独立 API 执行结果，共形成 %d 个样本，其中 %d 个回答有效、%d 个回答失败。%s 的基础收录率为 %.1f%%，累计提及 %.0f 次；当前核心矛盾集中在推荐优先级、信息完整度、可核验信源供给与竞品共现挤压。TOP3 占比 %.1f%%、官方事实采纳率 %.1f%%、可核验引用率 %.1f%%、品牌声量占比 %.1f%%。",
			diagnosisPreparationSummary(preparationAttempt), diagnosis.QuestionCount, diagnosis.ModelCount, diagnosis.TaskCount, succeeded, failed, profile.BrandName, brandRate*100, mentionCount, top3Rate*100, contentAdoptionRate*100, citationRate*100, shareOfVoice*100,
		),
		OverallConclusion: diagnosisOverallConclusion(profile.BrandName, brandRate, citationRate, shareOfVoice, failed),
		Methodology:       "系统先由一个已选模型完成品牌主体辨识、品牌相关词与统一诊断问题生成，并保存准备阶段的提示词及每次原始响应；再将同一组问题分别发送给各个已选 AI 平台模型的独立 API。系统完整保存逐平台提示词、真实回答原文、提供商请求编号和结构化引用，随后按 V4 规则抽取收录状态、提及率、信息完整度、回答质量、推荐位次、引用份额、竞品共现、情感和官方事实命中。每项指标均可下钻到不可变回答、结构分析和引用证据。报告仅聚合每个任务最近一次有效尝试。",
		Disclaimer:        "本报告是售前诊断材料，仅反映所选平台模型、问题、配置和执行时间下的样本结果。普通模型知识回答不代表实时网页收录；只有接口真实返回且可核验的来源才计入信源指标。报告不包含报价、效果承诺或指定发布平台承诺，具体实施模块与交付节奏将在后续正式方案中单独提供。",
		GeneratedAt:       now, Version: maxVersion + 1, IsCurrent: true,
	}
	if status == model.SalesDiagnosisStatusFailed {
		report.OverallConclusion = "本次诊断没有获得有效模型回答，报告仅保留执行范围和失败情况，不能据此判断品牌 GEO 表现。"
	}
	if err := tx.Create(report).Error; err != nil {
		return err
	}

	platformEvidence, err := loadDiagnosisPlatformEvidence(tx, diagnosis.ID)
	if err != nil {
		return err
	}
	modelReports := buildDiagnosisReportModels(report.ID, diagnosisModels, tasks, metricValues, platformEvidence)
	if len(modelReports) > 0 {
		if err := tx.Create(&modelReports).Error; err != nil {
			return err
		}
	}
	if err := buildDiagnosisReportEntitiesAndSources(tx, report.ID, diagnosis.ID, &profile); err != nil {
		return err
	}
	questionReports, answers := buildDiagnosisReportQuestions(report.ID, questions, diagnosisModels, tasks, resultByTask, competitorCounts)
	if len(questionReports) > 0 {
		if err := tx.Create(&questionReports).Error; err != nil {
			return err
		}
		questionReportIDs := make(map[uint64]uint64, len(questionReports))
		for _, question := range questionReports {
			questionReportIDs[question.QuestionID] = question.ID
		}
		for i := range answers {
			answers[i].ReportQuestionID = questionReportIDs[answers[i].ReportQuestionID]
		}
		if len(answers) > 0 {
			if err := tx.Create(&answers).Error; err != nil {
				return err
			}
		}
	}
	citationAvailable := metricValues[diagnosisReportMetricKey(0, "citation_rate")].AvailabilityStatus == model.SalesDiagnosisMetricAvailabilityAvailable
	top3Available := metricValues[diagnosisReportMetricKey(0, "top3_rate")].AvailabilityStatus == model.SalesDiagnosisMetricAvailabilityAvailable
	contentAvailable := metricValues[diagnosisReportMetricKey(0, "content_adoption_rate")].AvailabilityStatus == model.SalesDiagnosisMetricAvailabilityAvailable
	findings := buildDiagnosisReportFindings(report.ID, profile.BrandName, preparationAttempt.Industry, brandRate, citationRate, shareOfVoice, top3Rate, contentAdoptionRate, citationAvailable, top3Available, contentAvailable, failed)
	if len(findings) > 0 {
		if err := tx.Create(&findings).Error; err != nil {
			return err
		}
		var overallMetricIDs []uint64
		for _, metric := range metrics {
			if metric.ModelID == nil {
				overallMetricIDs = append(overallMetricIDs, metric.ID)
			}
		}
		evidences := make([]model.SalesDiagnosisFindingEvidence, 0, len(findings)*len(overallMetricIDs))
		for _, finding := range findings {
			for _, metricID := range overallMetricIDs {
				value := metricID
				evidences = append(evidences, model.SalesDiagnosisFindingEvidence{
					FindingID: finding.ID, MetricID: &value, EvidenceType: 1, Note: "报告生成时使用的总体指标",
				})
			}
		}
		if len(evidences) > 0 {
			return tx.Create(&evidences).Error
		}
	}
	return nil
}

func diagnosisPreparationSummary(attempt model.SalesDiagnosisPreparationAttempt) string {
	if attempt.ID == 0 {
		return ""
	}
	industry := strings.TrimSpace(attempt.Industry)
	if industry == "" {
		return "前置研究已完成品牌主体辨识和统一问题生成。"
	}
	return fmt.Sprintf("前置研究将诊断主体识别为%s行业，并据此生成品牌词和统一问题。", industry)
}

type diagnosisPlatformEvidence struct {
	SampleCount         uint32
	IncludedCount       uint32
	CompletenessTotal   float64
	AnswerQualityTotal  float64
	FreshnessTotal      float64
	FreshnessCount      uint32
	RecommendationTotal int64
	RecommendationCount uint32
	Strengths           []string
	Gaps                []string
}

func loadDiagnosisPlatformEvidence(tx *gorm.DB, diagnosisID uint64) (map[uint64]diagnosisPlatformEvidence, error) {
	type row struct {
		ModelID                uint64
		Included               bool
		CompletenessScore      float64
		AnswerQualityScore     float64
		FreshnessScore         float64
		FreshnessAvailable     bool
		RecommendationPosition int32
		Strengths              string
		Gaps                   string
	}
	var rows []row
	if err := tx.Raw(`
		SELECT t.diagnosis_model_id AS model_id, a.included, a.completeness_score,
		       a.answer_quality_score, a.freshness_score, a.freshness_available,
		       a.recommendation_position, a.strengths, a.gaps
		FROM sls_diagnosis_tasks t
		JOIN sls_diagnosis_results r ON r.task_id = t.id AND r.attempt_no = t.attempt_count AND r.succeeded = TRUE
		JOIN sls_diagnosis_result_analyses a ON a.result_id = r.id AND a.analysis_version = 1
		WHERE t.diagnosis_id = ?`, diagnosisID).Scan(&rows).Error; err != nil {
		return nil, err
	}
	items := make(map[uint64]diagnosisPlatformEvidence)
	for _, row := range rows {
		item := items[row.ModelID]
		item.SampleCount++
		if row.Included {
			item.IncludedCount++
		}
		item.CompletenessTotal += row.CompletenessScore
		item.AnswerQualityTotal += row.AnswerQualityScore
		if row.FreshnessAvailable {
			item.FreshnessCount++
			item.FreshnessTotal += row.FreshnessScore
		}
		if row.RecommendationPosition > 0 {
			item.RecommendationCount++
			item.RecommendationTotal += int64(row.RecommendationPosition)
		}
		item.Strengths = appendDiagnosisUniqueText(item.Strengths, row.Strengths)
		item.Gaps = appendDiagnosisUniqueText(item.Gaps, row.Gaps)
		items[row.ModelID] = item
	}
	return items, nil
}

func buildDiagnosisReportModels(reportID uint64, diagnosisModels []model.SalesDiagnosisModel, tasks []model.SalesDiagnosisTask, metrics map[string]model.SalesDiagnosisMetric, platformEvidence map[uint64]diagnosisPlatformEvidence) []model.SalesDiagnosisReportModel {
	items := make([]model.SalesDiagnosisReportModel, 0, len(diagnosisModels))
	for _, diagnosisModel := range diagnosisModels {
		var samples, succeeded, failed uint32
		for _, task := range tasks {
			if task.DiagnosisModelID != diagnosisModel.ID {
				continue
			}
			samples++
			switch task.Status {
			case model.SalesDiagnosisTaskStatusSucceeded:
				succeeded++
			case model.SalesDiagnosisTaskStatusFailed:
				failed++
			}
		}
		brandRate := diagnosisReportMetricValue(metrics, diagnosisModel.ID, "brand_mention_rate")
		citationRate := diagnosisReportMetricValue(metrics, diagnosisModel.ID, "citation_rate")
		shareOfVoice := diagnosisReportMetricValue(metrics, diagnosisModel.ID, "brand_share_of_voice")
		mentionCount := uint32(diagnosisReportMetricValue(metrics, diagnosisModel.ID, "brand_mention_count"))
		top3Metric := metrics[diagnosisReportMetricKey(diagnosisModel.ID, "top3_rate")]
		contentMetric := metrics[diagnosisReportMetricKey(diagnosisModel.ID, "content_adoption_rate")]
		citationMetric := metrics[diagnosisReportMetricKey(diagnosisModel.ID, "citation_rate")]
		positiveMetric := metrics[diagnosisReportMetricKey(diagnosisModel.ID, "positive_sentiment_rate")]
		neutralMetric := metrics[diagnosisReportMetricKey(diagnosisModel.ID, "neutral_sentiment_rate")]
		negativeMetric := metrics[diagnosisReportMetricKey(diagnosisModel.ID, "negative_sentiment_rate")]
		evidence := platformEvidence[diagnosisModel.ID]
		inclusionRate, completenessScore, answerQualityScore := 0.0, 0.0, 0.0
		if evidence.SampleCount > 0 {
			inclusionRate = float64(evidence.IncludedCount) / float64(evidence.SampleCount)
			completenessScore = evidence.CompletenessTotal / float64(evidence.SampleCount)
			answerQualityScore = evidence.AnswerQualityTotal / float64(evidence.SampleCount)
		}
		averagePosition := 0.0
		if evidence.RecommendationCount > 0 {
			averagePosition = float64(evidence.RecommendationTotal) / float64(evidence.RecommendationCount)
		}
		timelinessRate := 0.0
		if evidence.FreshnessCount > 0 {
			timelinessRate = evidence.FreshnessTotal / float64(evidence.FreshnessCount)
		}
		rating := diagnosisPlatformRating(inclusionRate, completenessScore, answerQualityScore)
		conclusion := fmt.Sprintf("%s 当前评级为%s。AI 高权重信源中的结构化品牌事实供给仍需结合完整度、推荐位次和时效性指标持续补强。", diagnosisModel.DisplayName, rating)
		items = append(items, model.SalesDiagnosisReportModel{
			ReportID: reportID, DiagnosisModelID: diagnosisModel.ID, ModelName: diagnosisModel.DisplayName,
			SampleCount: samples, SucceededCount: succeeded, FailedCount: failed,
			BrandMentionRate: brandRate, CitationRate: citationRate, BrandShareOfVoice: shareOfVoice,
			InclusionRate: inclusionRate, CompletenessScore: completenessScore, AnswerQualityScore: answerQualityScore,
			AverageRecommendationPosition:   averagePosition,
			RecommendationPositionAvailable: evidence.RecommendationCount > 0,
			TimelinessRate:                  timelinessRate, TimelinessAvailable: evidence.FreshnessCount > 0,
			OverallRating: rating, Strengths: strings.Join(evidence.Strengths, "；"),
			Gaps: strings.Join(evidence.Gaps, "；"), DiagnosisConclusion: conclusion,
			MentionCount: mentionCount, Top3Rate: top3Metric.Value,
			Top3Available:            top3Metric.AvailabilityStatus == model.SalesDiagnosisMetricAvailabilityAvailable,
			ContentAdoptionRate:      contentMetric.Value,
			ContentAdoptionAvailable: contentMetric.AvailabilityStatus == model.SalesDiagnosisMetricAvailabilityAvailable,
			CitationAvailable:        citationMetric.AvailabilityStatus == model.SalesDiagnosisMetricAvailabilityAvailable,
			PositiveCount:            uint32(positiveMetric.Numerator), NeutralCount: uint32(neutralMetric.Numerator),
			NegativeCount:         uint32(negativeMetric.Numerator),
			UnknownSentimentCount: succeeded - uint32(positiveMetric.Numerator+neutralMetric.Numerator+negativeMetric.Numerator),
			Summary:               fmt.Sprintf("%s 完成 %d/%d 个问题，品牌提及率 %.1f%%、累计提及 %d 次、声量占比 %.1f%%。", diagnosisModel.DisplayName, succeeded, samples, brandRate*100, mentionCount, shareOfVoice*100),
			SortOrder:             diagnosisModel.SortOrder,
		})
	}
	return items
}

func diagnosisPlatformRating(inclusionRate, completenessScore, answerQualityScore float64) string {
	score := inclusionRate*0.4 + completenessScore*0.3 + answerQualityScore*0.3
	switch {
	case score >= 0.8:
		return "优秀"
	case score >= 0.65:
		return "良好"
	case score >= 0.45:
		return "一般"
	default:
		return "待提升"
	}
}

func appendDiagnosisUniqueText(items []string, value string) []string {
	value = strings.TrimSpace(value)
	if value == "" {
		return items
	}
	for _, item := range items {
		if item == value {
			return items
		}
	}
	if len(items) >= 3 {
		return items
	}
	return append(items, value)
}

func diagnosisReportMetricValue(metrics map[string]model.SalesDiagnosisMetric, modelID uint64, code string) float64 {
	return metrics[diagnosisReportMetricKey(modelID, code)].Value
}

func buildDiagnosisReportEntitiesAndSources(tx *gorm.DB, reportID, diagnosisID uint64, profile *model.SalesDiagnosisProfile) error {
	type entityEvidence struct {
		EntityMentionID uint64
		ModelID         uint64
		ResultID        uint64
		EntityType      int32
		EntityName      string
		MentionCount    uint32
		RankPosition    int32
		Sentiment       int32
		EvidenceExcerpt string
	}
	var entityRows []entityEvidence
	if err := tx.Raw(`
		SELECT e.id AS entity_mention_id, t.diagnosis_model_id AS model_id, r.id AS result_id,
		       e.entity_type, e.entity_name, e.mention_count, e.rank_position, e.sentiment, e.evidence_excerpt
		FROM sls_diagnosis_tasks t
		JOIN sls_diagnosis_results r ON r.task_id = t.id AND r.attempt_no = t.attempt_count AND r.succeeded = TRUE
		JOIN sls_diagnosis_result_analyses a ON a.result_id = r.id AND a.analysis_version = 1
		JOIN sls_diagnosis_entity_mentions e ON e.analysis_id = a.id
		WHERE t.diagnosis_id = ?`, diagnosisID).Scan(&entityRows).Error; err != nil {
		return err
	}
	type entityAggregate struct {
		ModelID, MentionCount, MentionedResults, RankCount, Top3Count, Positive, Neutral, Negative uint64
		EntityType                                                                                 int32
		EntityName                                                                                 string
		RankTotal                                                                                  int64
		EvidenceMentionIDs                                                                         []uint64
		RecommendationReason                                                                       string
	}
	entityByKey := make(map[string]*entityAggregate)
	successCounts := make(map[uint64]uint64)
	seenResults := make(map[string]struct{})
	for _, row := range entityRows {
		for _, modelID := range []uint64{row.ModelID, 0} {
			resultKey := fmt.Sprintf("%d:%d", modelID, row.ResultID)
			if _, exists := seenResults[resultKey]; !exists {
				seenResults[resultKey] = struct{}{}
				successCounts[modelID]++
			}
			key := fmt.Sprintf("%d:%d:%s", modelID, row.EntityType, strings.ToLower(row.EntityName))
			aggregate := entityByKey[key]
			if aggregate == nil {
				aggregate = &entityAggregate{ModelID: modelID, EntityType: row.EntityType, EntityName: row.EntityName}
				entityByKey[key] = aggregate
			}
			aggregate.MentionCount += uint64(row.MentionCount)
			aggregate.EvidenceMentionIDs = append(aggregate.EvidenceMentionIDs, row.EntityMentionID)
			if aggregate.RecommendationReason == "" && strings.TrimSpace(row.EvidenceExcerpt) != "" {
				aggregate.RecommendationReason = strings.TrimSpace(row.EvidenceExcerpt)
			}
			if row.MentionCount > 0 {
				aggregate.MentionedResults++
			}
			if row.RankPosition > 0 {
				aggregate.RankTotal += int64(row.RankPosition)
				aggregate.RankCount++
				if row.RankPosition <= 3 {
					aggregate.Top3Count++
				}
			}
			switch row.Sentiment {
			case biz.SalesDiagnosisSentimentPositive:
				aggregate.Positive++
			case biz.SalesDiagnosisSentimentNeutral:
				aggregate.Neutral++
			case biz.SalesDiagnosisSentimentNegative:
				aggregate.Negative++
			}
		}
	}
	entityAggregates := make([]*entityAggregate, 0, len(entityByKey))
	for _, aggregate := range entityByKey {
		entityAggregates = append(entityAggregates, aggregate)
	}
	sort.Slice(entityAggregates, func(i, j int) bool {
		if entityAggregates[i].ModelID != entityAggregates[j].ModelID {
			return entityAggregates[i].ModelID < entityAggregates[j].ModelID
		}
		return entityAggregates[i].MentionCount > entityAggregates[j].MentionCount
	})
	entities := make([]model.SalesDiagnosisReportEntity, 0, len(entityAggregates))
	for _, aggregate := range entityAggregates {
		var modelID *uint64
		if aggregate.ModelID != 0 {
			value := aggregate.ModelID
			modelID = &value
		}
		mentionRate, averageRank := float64(0), float64(0)
		if successCounts[aggregate.ModelID] > 0 {
			mentionRate = float64(aggregate.MentionedResults) / float64(successCounts[aggregate.ModelID])
		}
		if aggregate.RankCount > 0 {
			averageRank = float64(aggregate.RankTotal) / float64(aggregate.RankCount)
		}
		competitorLevel := int32(0)
		if aggregate.EntityType == biz.SalesDiagnosisEntityConfiguredCompetitor {
			competitorLevel = 1
		} else if aggregate.EntityType == biz.SalesDiagnosisEntityOtherBrand {
			competitorLevel = 2
		}
		threatLevel := int32(0)
		if competitorLevel > 0 {
			switch {
			case mentionRate >= 0.75:
				threatLevel = 4
			case mentionRate >= 0.5:
				threatLevel = 3
			case mentionRate >= 0.25:
				threatLevel = 2
			default:
				threatLevel = 1
			}
		}
		location := ""
		if aggregate.EntityType == biz.SalesDiagnosisEntityTargetBrand && profile != nil {
			location = profile.Region
		}
		entities = append(entities, model.SalesDiagnosisReportEntity{
			ReportID: reportID, DiagnosisModelID: modelID, EntityType: aggregate.EntityType,
			EntityName: aggregate.EntityName, CompetitorLevel: competitorLevel, ThreatLevel: threatLevel,
			Location: location, RecommendationReason: aggregate.RecommendationReason,
			MentionCount: uint32(aggregate.MentionCount),
			MentionRate:  mentionRate, AverageRank: averageRank, Top3Count: uint32(aggregate.Top3Count),
			PositiveCount: uint32(aggregate.Positive), NeutralCount: uint32(aggregate.Neutral),
			NegativeCount: uint32(aggregate.Negative), SortOrder: int32(len(entities)),
		})
	}
	if len(entities) > 0 {
		if err := tx.Create(&entities).Error; err != nil {
			return err
		}
		evidences := make([]model.SalesDiagnosisReportEntityEvidence, 0)
		for i, aggregate := range entityAggregates {
			for _, mentionID := range aggregate.EvidenceMentionIDs {
				evidences = append(evidences, model.SalesDiagnosisReportEntityEvidence{
					ReportEntityID: entities[i].ID, EntityMentionID: mentionID,
				})
			}
		}
		if len(evidences) > 0 {
			if err := tx.Create(&evidences).Error; err != nil {
				return err
			}
		}
	}
	type sourceEvidence struct {
		CitationID    uint64
		ModelID       uint64
		Domain        string
		SourceName    string
		OwnershipType int32
		SourceType    int32
	}
	var sourceRows []sourceEvidence
	if err := tx.Raw(`
		SELECT c.id AS citation_id, t.diagnosis_model_id AS model_id, c.domain, c.source_name, c.ownership_type, c.source_type
		FROM sls_diagnosis_tasks t
		JOIN sls_diagnosis_results r ON r.task_id = t.id AND r.attempt_no = t.attempt_count AND r.succeeded = TRUE
		JOIN sls_diagnosis_citations c ON c.result_id = r.id
		WHERE t.diagnosis_id = ?`, diagnosisID).Scan(&sourceRows).Error; err != nil {
		return err
	}
	type sourceAggregate struct {
		ModelID       uint64
		Domain        string
		SourceName    string
		OwnershipType int32
		SourceType    int32
		CitationCount uint32
		CitationIDs   []uint64
	}
	sourceByKey := make(map[string]*sourceAggregate)
	sourceCounts := make(map[uint64]uint32)
	for _, row := range sourceRows {
		for _, modelID := range []uint64{row.ModelID, 0} {
			key := fmt.Sprintf("%d:%d:%s", modelID, row.OwnershipType, strings.ToLower(row.Domain))
			aggregate := sourceByKey[key]
			if aggregate == nil {
				aggregate = &sourceAggregate{ModelID: modelID, Domain: row.Domain, SourceName: row.SourceName, OwnershipType: row.OwnershipType, SourceType: row.SourceType}
				sourceByKey[key] = aggregate
			}
			aggregate.CitationCount++
			aggregate.CitationIDs = append(aggregate.CitationIDs, row.CitationID)
			sourceCounts[modelID]++
		}
	}
	sourceAggregates := make([]*sourceAggregate, 0, len(sourceByKey))
	for _, aggregate := range sourceByKey {
		sourceAggregates = append(sourceAggregates, aggregate)
	}
	sort.Slice(sourceAggregates, func(i, j int) bool {
		if sourceAggregates[i].ModelID != sourceAggregates[j].ModelID {
			return sourceAggregates[i].ModelID < sourceAggregates[j].ModelID
		}
		return sourceAggregates[i].CitationCount > sourceAggregates[j].CitationCount
	})
	sources := make([]model.SalesDiagnosisReportSource, 0, len(sourceAggregates))
	for _, aggregate := range sourceAggregates {
		var modelID *uint64
		if aggregate.ModelID != 0 {
			value := aggregate.ModelID
			modelID = &value
		}
		share := float64(0)
		if sourceCounts[aggregate.ModelID] > 0 {
			share = float64(aggregate.CitationCount) / float64(sourceCounts[aggregate.ModelID])
		}
		sources = append(sources, model.SalesDiagnosisReportSource{
			ReportID: reportID, DiagnosisModelID: modelID, Domain: aggregate.Domain,
			SourceName: aggregate.SourceName, OwnershipType: aggregate.OwnershipType, SourceType: aggregate.SourceType,
			CitationCount: aggregate.CitationCount,
			ShareRate:     share, SortOrder: int32(len(sources)),
		})
	}
	if len(sources) > 0 {
		if err := tx.Create(&sources).Error; err != nil {
			return err
		}
		citations := make([]model.SalesDiagnosisReportSourceCitation, 0)
		for i, aggregate := range sourceAggregates {
			for _, citationID := range aggregate.CitationIDs {
				citations = append(citations, model.SalesDiagnosisReportSourceCitation{
					ReportSourceID: sources[i].ID, CitationID: citationID,
				})
			}
		}
		if len(citations) > 0 {
			return tx.Create(&citations).Error
		}
	}
	return nil
}

func buildDiagnosisReportQuestions(reportID uint64, questions []model.SalesDiagnosisQuestion, diagnosisModels []model.SalesDiagnosisModel, tasks []model.SalesDiagnosisTask, results map[uint64]model.SalesDiagnosisResult, competitorCounts map[uint64]int64) ([]model.SalesDiagnosisReportQuestion, []model.SalesDiagnosisReportAnswer) {
	modelNames := make(map[uint64]string, len(diagnosisModels))
	for _, diagnosisModel := range diagnosisModels {
		modelNames[diagnosisModel.ID] = diagnosisModel.DisplayName
	}
	items := make([]model.SalesDiagnosisReportQuestion, 0, len(questions))
	var answers []model.SalesDiagnosisReportAnswer
	for _, question := range questions {
		var successful, failed, brandMentioned, competitorMentioned uint32
		questionAnswers := make([]model.SalesDiagnosisReportAnswer, 0, len(diagnosisModels))
		for _, task := range tasks {
			if task.QuestionID != question.ID {
				continue
			}
			result, hasResult := results[task.ID]
			if task.Status == model.SalesDiagnosisTaskStatusSucceeded && hasResult && result.Succeeded {
				successful++
				if result.BrandMentioned {
					brandMentioned++
				}
				if competitorCounts[result.ID] > 0 {
					competitorMentioned++
				}
				questionAnswers = append(questionAnswers, model.SalesDiagnosisReportAnswer{
					ReportQuestionID: question.ID, ResultID: result.ID, DiagnosisModelID: task.DiagnosisModelID,
					ModelName: modelNames[task.DiagnosisModelID], AnswerExcerpt: diagnosisReportExcerpt(result.Answer),
					BrandMentioned: result.BrandMentioned, EvidenceType: result.EvidenceType,
					SortOrder: int32(len(questionAnswers)),
				})
			} else if task.Status == model.SalesDiagnosisTaskStatusFailed {
				failed++
			}
		}
		items = append(items, model.SalesDiagnosisReportQuestion{
			ReportID: reportID, QuestionID: question.ID, Question: question.Question,
			SuccessfulModelCount: successful, FailedModelCount: failed,
			BrandMentionedModelCount: brandMentioned, CompetitorMentionModelCount: competitorMentioned,
			Summary:   fmt.Sprintf("%d 个模型给出有效回答，其中 %d 个提及目标品牌，%d 个提及已配置竞品。", successful, brandMentioned, competitorMentioned),
			SortOrder: question.SortOrder,
		})
		answers = append(answers, questionAnswers...)
	}
	return items, answers
}

func buildDiagnosisReportFindings(reportID uint64, brandName, industry string, brandRate, citationRate, shareOfVoice, top3Rate, contentAdoptionRate float64, citationAvailable, top3Available, contentAvailable bool, failed int64) []model.SalesDiagnosisReportFinding {
	var items []model.SalesDiagnosisReportFinding
	appendFinding := func(section string, priority, impact, urgency, findingType, severity int32, title, content string) {
		items = append(items, model.SalesDiagnosisReportFinding{
			ReportID: reportID, Type: findingType, Severity: severity, SectionCode: section,
			Priority: priority, ImpactLevel: impact, UrgencyLevel: urgency,
			Title: title, Content: content, SortOrder: int32(len(items)),
		})
	}
	if brandRate < 0.4 {
		appendFinding("internal_gap", 0, 3, 3, model.SalesDiagnosisReportFindingIssue, model.SalesDiagnosisReportSeverityHigh, "基础收录与主动提及不足", fmt.Sprintf("%s 的综合提及率为 %.1f%%。根因指向 AI 可抓取的结构化品牌事实与场景内容供给不足。", brandName, brandRate*100))
	} else if brandRate < 0.7 {
		appendFinding("internal_gap", 1, 3, 2, model.SalesDiagnosisReportFindingOpportunity, model.SalesDiagnosisReportSeverityMedium, "平台收录表现不均衡", fmt.Sprintf("%s 已在部分回答中出现，但综合提及率 %.1f%% 尚未形成稳定覆盖，需要补强 AI 高权重信源中的结构化内容供给。", brandName, brandRate*100))
	} else {
		appendFinding("internal_gap", 2, 2, 1, model.SalesDiagnosisReportFindingOpportunity, model.SalesDiagnosisReportSeverityInfo, "基础收录较稳定", fmt.Sprintf("%s 的综合提及率达到 %.1f%%，下一阶段应重点优化推荐优先级、内容丰富度与信源质量。", brandName, brandRate*100))
	}
	if !citationAvailable {
		appendFinding("internal_gap", 2, 2, 2, model.SalesDiagnosisReportFindingIssue, model.SalesDiagnosisReportSeverityInfo, "信源指标暂不可用", "本次部分接口没有返回可核验的结构化信源，不能将其解释为零收录；后续应持续补充可被 AI 抓取和引用的高权重内容证据。")
	} else if citationRate == 0 {
		appendFinding("internal_gap", 1, 3, 2, model.SalesDiagnosisReportFindingIssue, model.SalesDiagnosisReportSeverityMedium, "可核验信源不足", "具备信源能力的模型没有返回真实引用，说明当前可被 AI 识别和引用的高权重内容证据仍需补强。")
	}
	if top3Available && top3Rate < 0.4 {
		appendFinding("internal_gap", 0, 3, 3, model.SalesDiagnosisReportFindingIssue, model.SalesDiagnosisReportSeverityHigh, "推荐优先级偏后", fmt.Sprintf("在具有明确推荐顺序的样本中，目标品牌进入前三的比例为 %.1f%%，差异化事实与场景内容尚未形成稳定优势。", top3Rate*100))
	}
	if contentAvailable && contentAdoptionRate < 0.4 {
		appendFinding("internal_gap", 0, 3, 3, model.SalesDiagnosisReportFindingOpportunity, model.SalesDiagnosisReportSeverityHigh, "品牌事实采纳不足", fmt.Sprintf("模型回答对冻结官方事实的采纳率为 %.1f%%，说明品牌定位、核心产品和差异化卖点尚未形成充足的结构化公开表达。", contentAdoptionRate*100))
	}
	if shareOfVoice < 0.5 {
		appendFinding("external_gap", 0, 3, 3, model.SalesDiagnosisReportFindingIssue, model.SalesDiagnosisReportSeverityHigh, "竞品共现声量占优", fmt.Sprintf("目标品牌在品牌与竞品共现提及中的声量占比为 %.1f%%。竞品差异化信息更易被 AI 抓取，需要补强本品牌的差异化内容矩阵。", shareOfVoice*100))
	}
	if failed > 0 {
		appendFinding("summary", 3, 1, 1, model.SalesDiagnosisReportFindingIssue, model.SalesDiagnosisReportSeverityMedium, "存在失败样本", fmt.Sprintf("本次有 %d 个模型任务失败，解读结论时应结合各平台有效样本数。", failed))
	}
	industryContext := strings.TrimSpace(industry)
	if industryContext != "" {
		industryContext = "围绕" + industryContext + "行业的核心决策问题，"
	}
	appendFinding("optimization", 0, 3, 3, model.SalesDiagnosisReportFindingRecommendation, model.SalesDiagnosisReportSeverityHigh, "知识库重构与内容焕新", industryContext+"优先沉淀统一、可验证的品牌事实与产品知识，持续补充具备时效性的结构化内容，解决 AI 信息不完整和信息滞后问题。")
	appendFinding("optimization", 1, 3, 2, model.SalesDiagnosisReportFindingRecommendation, model.SalesDiagnosisReportSeverityHigh, "补齐平台短板，强化高权重信源供给", "针对表现偏弱的平台和查询场景，增加可抓取、可引用、结构清晰的内容供给，提升平台间收录与推荐表现的一致性。")
	appendFinding("optimization", 1, 3, 2, model.SalesDiagnosisReportFindingRecommendation, model.SalesDiagnosisReportSeverityMedium, "差异化内容矩阵与竞品防御", "围绕品牌优势、核心场景和竞品共现问题建设差异化内容矩阵，使 AI 在对比和推荐回答中获得更充分的本品牌证据。")
	appendFinding("optimization", 2, 2, 2, model.SalesDiagnosisReportFindingRecommendation, model.SalesDiagnosisReportSeverityMedium, "常态化监测与策略迭代", "持续复用同一组核心问题监测收录、推荐位次、情感、竞品共现与信源变化，通过数据看板推动策略迭代并沉淀客户自有内容资产。")
	return items
}

func diagnosisOverallConclusion(brandName string, brandRate, citationRate, shareOfVoice float64, failed int64) string {
	level := "偏低"
	if brandRate >= 0.7 {
		level = "较好"
	} else if brandRate >= 0.4 {
		level = "一般"
	}
	return fmt.Sprintf("%s 在本次多模型样本中的品牌可见度表现%s。综合提及率 %.1f%%、可核验引用率 %.1f%%、品牌声量占比 %.1f%%；其中 %d 个任务失败，结论需结合各模型样本量审慎使用。", brandName, level, brandRate*100, citationRate*100, shareOfVoice*100, failed)
}

func diagnosisReportMetricKey(modelID uint64, code string) string {
	return fmt.Sprintf("%d:%s", modelID, code)
}

func diagnosisReportExcerpt(value string) string {
	runes := []rune(strings.TrimSpace(value))
	if len(runes) <= diagnosisReportExcerptLimit {
		return string(runes)
	}
	return string(runes[:diagnosisReportExcerptLimit]) + "……"
}

func (r *salesDiagnosisRepo) hydrateReports(ctx context.Context, ids []uint64, byID map[uint64]*biz.SalesDiagnosis) error {
	var reports []model.SalesDiagnosisReport
	if err := r.data.DB(ctx).Where("diagnosis_id IN ? AND is_current = TRUE", ids).Find(&reports).Error; err != nil {
		return err
	}
	if len(reports) == 0 {
		return nil
	}
	reportIDs := make([]uint64, 0, len(reports))
	reportByID := make(map[uint64]*biz.SalesDiagnosisReport, len(reports))
	for _, report := range reports {
		item := &biz.SalesDiagnosisReport{
			ID: report.ID, Status: report.Status, TemplateCode: report.TemplateCode,
			TemplateVersion: report.TemplateVersion, Title: report.Title,
			ExecutiveSummary: report.ExecutiveSummary, OverallConclusion: report.OverallConclusion,
			Methodology: report.Methodology, Disclaimer: report.Disclaimer,
			GeneratedAt: report.GeneratedAt, Version: report.Version,
		}
		byID[report.DiagnosisID].Report = item
		reportByID[report.ID] = item
		reportIDs = append(reportIDs, report.ID)
	}
	var modelReports []model.SalesDiagnosisReportModel
	if err := r.data.DB(ctx).Where("report_id IN ?", reportIDs).Order("report_id, sort_order, id").Find(&modelReports).Error; err != nil {
		return err
	}
	for _, item := range modelReports {
		reportByID[item.ReportID].Models = append(reportByID[item.ReportID].Models, &biz.SalesDiagnosisReportModel{
			ID: item.ID, DiagnosisModelID: item.DiagnosisModelID, ModelName: item.ModelName,
			SampleCount: item.SampleCount, SucceededCount: item.SucceededCount, FailedCount: item.FailedCount,
			BrandMentionRate: item.BrandMentionRate, CitationRate: item.CitationRate,
			InclusionRate: item.InclusionRate, CompletenessScore: item.CompletenessScore,
			AnswerQualityScore:              item.AnswerQualityScore,
			AverageRecommendationPosition:   item.AverageRecommendationPosition,
			RecommendationPositionAvailable: item.RecommendationPositionAvailable,
			TimelinessRate:                  item.TimelinessRate, TimelinessAvailable: item.TimelinessAvailable,
			OverallRating: item.OverallRating, Strengths: item.Strengths, Gaps: item.Gaps,
			DiagnosisConclusion: item.DiagnosisConclusion,
			BrandShareOfVoice:   item.BrandShareOfVoice, MentionCount: item.MentionCount,
			Top3Rate: item.Top3Rate, Top3Available: item.Top3Available,
			ContentAdoptionRate: item.ContentAdoptionRate, ContentAdoptionAvailable: item.ContentAdoptionAvailable,
			CitationAvailable: item.CitationAvailable, PositiveCount: item.PositiveCount,
			NeutralCount: item.NeutralCount, NegativeCount: item.NegativeCount,
			UnknownSentimentCount: item.UnknownSentimentCount, Summary: item.Summary, SortOrder: item.SortOrder,
		})
	}
	var entities []model.SalesDiagnosisReportEntity
	if err := r.data.DB(ctx).Where("report_id IN ?", reportIDs).Order("report_id, sort_order, id").Find(&entities).Error; err != nil {
		return err
	}
	entityByID := make(map[uint64]*biz.SalesDiagnosisReportEntity, len(entities))
	entityIDs := make([]uint64, 0, len(entities))
	for _, item := range entities {
		modelID := uint64(0)
		if item.DiagnosisModelID != nil {
			modelID = *item.DiagnosisModelID
		}
		entity := &biz.SalesDiagnosisReportEntity{
			ID: item.ID, DiagnosisModelID: modelID, EntityType: item.EntityType, EntityName: item.EntityName,
			CompetitorLevel: item.CompetitorLevel, ThreatLevel: item.ThreatLevel,
			Location: item.Location, RecommendationReason: item.RecommendationReason,
			MentionCount: item.MentionCount, MentionRate: item.MentionRate, AverageRank: item.AverageRank,
			Top3Count: item.Top3Count, PositiveCount: item.PositiveCount, NeutralCount: item.NeutralCount,
			NegativeCount: item.NegativeCount, SortOrder: item.SortOrder,
		}
		reportByID[item.ReportID].Entities = append(reportByID[item.ReportID].Entities, entity)
		entityByID[item.ID] = entity
		entityIDs = append(entityIDs, item.ID)
	}
	if len(entityIDs) > 0 {
		var evidences []model.SalesDiagnosisReportEntityEvidence
		if err := r.data.DB(ctx).Where("report_entity_id IN ?", entityIDs).Order("report_entity_id, id").Find(&evidences).Error; err != nil {
			return err
		}
		for _, evidence := range evidences {
			entityByID[evidence.ReportEntityID].EvidenceMentionIDs = append(entityByID[evidence.ReportEntityID].EvidenceMentionIDs, evidence.EntityMentionID)
		}
	}
	var sources []model.SalesDiagnosisReportSource
	if err := r.data.DB(ctx).Where("report_id IN ?", reportIDs).Order("report_id, sort_order, id").Find(&sources).Error; err != nil {
		return err
	}
	sourceByID := make(map[uint64]*biz.SalesDiagnosisReportSource, len(sources))
	sourceIDs := make([]uint64, 0, len(sources))
	for _, item := range sources {
		modelID := uint64(0)
		if item.DiagnosisModelID != nil {
			modelID = *item.DiagnosisModelID
		}
		source := &biz.SalesDiagnosisReportSource{
			ID: item.ID, DiagnosisModelID: modelID, Domain: item.Domain, SourceName: item.SourceName,
			OwnershipType: item.OwnershipType, SourceType: item.SourceType,
			CitationCount: item.CitationCount, ShareRate: item.ShareRate, SortOrder: item.SortOrder,
		}
		reportByID[item.ReportID].Sources = append(reportByID[item.ReportID].Sources, source)
		sourceByID[item.ID] = source
		sourceIDs = append(sourceIDs, item.ID)
	}
	if len(sourceIDs) > 0 {
		var citations []model.SalesDiagnosisReportSourceCitation
		if err := r.data.DB(ctx).Where("report_source_id IN ?", sourceIDs).Order("report_source_id, id").Find(&citations).Error; err != nil {
			return err
		}
		for _, citation := range citations {
			sourceByID[citation.ReportSourceID].CitationIDs = append(sourceByID[citation.ReportSourceID].CitationIDs, citation.CitationID)
		}
	}
	var questionReports []model.SalesDiagnosisReportQuestion
	if err := r.data.DB(ctx).Where("report_id IN ?", reportIDs).Order("report_id, sort_order, id").Find(&questionReports).Error; err != nil {
		return err
	}
	questionReportIDs := make([]uint64, 0, len(questionReports))
	questionByID := make(map[uint64]*biz.SalesDiagnosisReportQuestion, len(questionReports))
	for _, item := range questionReports {
		question := &biz.SalesDiagnosisReportQuestion{
			ID: item.ID, QuestionID: item.QuestionID, Question: item.Question,
			SuccessfulModelCount: item.SuccessfulModelCount, FailedModelCount: item.FailedModelCount,
			BrandMentionedModelCount:      item.BrandMentionedModelCount,
			CompetitorMentionedModelCount: item.CompetitorMentionModelCount,
			Summary:                       item.Summary, SortOrder: item.SortOrder,
		}
		reportByID[item.ReportID].Questions = append(reportByID[item.ReportID].Questions, question)
		questionByID[item.ID] = question
		questionReportIDs = append(questionReportIDs, item.ID)
	}
	if len(questionReportIDs) > 0 {
		var answers []model.SalesDiagnosisReportAnswer
		if err := r.data.DB(ctx).Where("report_question_id IN ?", questionReportIDs).Order("report_question_id, sort_order, id").Find(&answers).Error; err != nil {
			return err
		}
		for _, item := range answers {
			questionByID[item.ReportQuestionID].Answers = append(questionByID[item.ReportQuestionID].Answers, &biz.SalesDiagnosisReportAnswer{
				ID: item.ID, ResultID: item.ResultID, DiagnosisModelID: item.DiagnosisModelID,
				ModelName: item.ModelName, AnswerExcerpt: item.AnswerExcerpt,
				BrandMentioned: item.BrandMentioned, EvidenceType: item.EvidenceType, SortOrder: item.SortOrder,
			})
		}
	}
	var findings []model.SalesDiagnosisReportFinding
	if err := r.data.DB(ctx).Where("report_id IN ?", reportIDs).Order("report_id, finding_type, sort_order, id").Find(&findings).Error; err != nil {
		return err
	}
	for _, item := range findings {
		reportByID[item.ReportID].Findings = append(reportByID[item.ReportID].Findings, &biz.SalesDiagnosisReportFinding{
			ID: item.ID, Type: item.Type, Severity: item.Severity, SectionCode: item.SectionCode,
			Priority: item.Priority, ImpactLevel: item.ImpactLevel, UrgencyLevel: item.UrgencyLevel, Title: item.Title,
			Content: item.Content, SortOrder: item.SortOrder,
		})
	}
	return nil
}
