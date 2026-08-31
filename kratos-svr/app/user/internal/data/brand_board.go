package data

import (
	"context"
	"encoding/json"
	stderrors "errors"
	"math"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/data/model"

	"gorm.io/gorm"
)

type brandBoardRepo struct{ data *Data }

// NewGeoBrandBoardRepo constructs a brand board repository backed by the user app database.
func NewGeoBrandBoardRepo(d *Data) biz.GeoBrandBoardRepo {
	return &brandBoardRepo{data: d}
}

// brandBoardTodayRange 返回北京时间当日的 [from, to) UTC 窗口。
// observed_at 以 UTC 存储，分桶与边界按北京时间计算后转 UTC。
func brandBoardTodayRange() (time.Time, time.Time) {
	now := time.Now().In(dashboardLoc)
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, dashboardLoc)
	end := start.AddDate(0, 0, 1)
	return start.UTC(), end.UTC()
}

// brandBoardPeriodRange 返回本期与上期 [from, to) UTC 窗口。
// week=指定日期所在周（周一至周日），month=指定日期所在月（1号至月末）。
// prevDate 为上一周期的基准日期。当 refDate 为空时使用当前时间。
func brandBoardPeriodRange(period string, refDate time.Time) (currFrom, currTo, prevFrom, prevTo time.Time) {
	if refDate.IsZero() {
		refDate = time.Now().In(dashboardLoc)
	}
	d := refDate.In(dashboardLoc)
	switch period {
	case "month":
		// 本期：该月1号 至 下月1号（前闭后开）
		currFrom = time.Date(d.Year(), d.Month(), 1, 0, 0, 0, 0, dashboardLoc)
		currTo = currFrom.AddDate(0, 1, 0)
		// 上期：上月1号 至 本月1号
		prevFrom = currFrom.AddDate(0, -1, 0)
		prevTo = currFrom
	default: // week
		// Go: Sunday=0, Monday=1, ... Saturday=6
		// 转换：周一为一周开始
		wd := int(d.Weekday())
		daysSinceMonday := (wd + 6) % 7 // Monday=0, Sunday=6
		weekStart := time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, dashboardLoc).AddDate(0, 0, -daysSinceMonday)
		currFrom = weekStart
		currTo = weekStart.AddDate(0, 0, 7) // 下周一 00:00:00（前闭后开）
		prevFrom = weekStart.AddDate(0, 0, -7)
		prevTo = weekStart
	}
	return currFrom.UTC(), currTo.UTC(), prevFrom.UTC(), prevTo.UTC()
}

// brandBoardParseDate 解析 "2006-01-02" 格式的日期，解析失败时返回零值。
func brandBoardParseDate(s string) time.Time {
	if s == "" {
		return time.Time{}
	}
	t, err := time.ParseInLocation("2006-01-02", s, dashboardLoc)
	if err != nil {
		return time.Time{}
	}
	return t
}

// brandTop3CaseExpr 是品牌 TOP3 占位率每行判定的 CASE 表达式：
// 当 snapshot 被判定为品牌收录（analysis.brand_mentioned=1）且
// result_json.brandRank（品牌在 AI 回答推荐列表中的行首序号排名）在 1~3 时计 1，否则 0。
// 无 brandRank 字段的历史数据视为无法判定排名（不计入 TOP3）。
const brandTop3CaseExpr = "CASE WHEN analysis.brand_mentioned = 1 AND " +
	"COALESCE(JSON_EXTRACT(analysis.result_json, '$.brandRank'), 0) BETWEEN 1 AND 3 " +
	"THEN 1 ELSE 0 END"

// brandMentionFilter 限定"提及次数"只统计品牌名与企业名称出现次数，
// 排除 contact（联系方式曝光，不是品牌名/企业名称）。
const brandMentionFilter = "m.entity_type IN ('brand', 'enterprise')"

// buildBrandTrendSeries 生成完整的日期序列（北京时间），缺失日期补 0/0.0。
// valueMap 用于收录/提及趋势（int64 计数），rateMap 用于可见度趋势（float64 占比）；
// 二者只传其一，另一个传 nil。
func buildBrandTrendSeries(r string, from, to time.Time, valueMap map[string]int64, rateMap map[string]float64) []*biz.BrandTrendPoint {
	var points []*biz.BrandTrendPoint
	fromLocal := from.In(dashboardLoc)
	toLocal := to.In(dashboardLoc)
	fill := func(bucket string) *biz.BrandTrendPoint {
		pt := &biz.BrandTrendPoint{Date: bucket}
		if valueMap != nil {
			pt.Value = valueMap[bucket]
		} else if rateMap != nil {
			pt.Rate = rateMap[bucket]
		}
		return pt
	}
	if r == "year" {
		year := fromLocal.Year()
		for m := 1; m <= 12; m++ {
			bucket := time.Date(year, time.Month(m), 1, 0, 0, 0, 0, dashboardLoc).Format("2006-01")
			points = append(points, fill(bucket))
		}
		return points
	}
	for d := time.Date(fromLocal.Year(), fromLocal.Month(), fromLocal.Day(), 0, 0, 0, 0, dashboardLoc); !d.After(toLocal); d = d.AddDate(0, 0, 1) {
		points = append(points, fill(d.Format("2006-01-02")))
	}
	return points
}

// GetCompanyInfo 企业名片 + 顶栏 4 统计卡 + 品牌词标签。
// 4 卡：关键词数 / 问题词条数 / 品牌收录总量 / 文章发布数。
func (r *brandBoardRepo) GetCompanyInfo(ctx context.Context, entID uint64) (*biz.BrandCompanyInfo, error) {
	db := r.data.DB(ctx)
	out := &biz.BrandCompanyInfo{}

	// 名片：enterprise + brand + active subscription
	var enterprise model.Enterprise
	if err := db.Where("id = ?", entID).First(&enterprise).Error; err != nil {
		return nil, err
	}
	var brand model.Brand
	_ = db.Where("enterprise_id = ? AND status = ?", entID, biz.BrandStatusActive).Order("id ASC").First(&brand).Error
	var subscription model.Subscription
	_ = db.Where("enterprise_id = ? AND status = ?", entID, "active").Order("expires_at DESC").First(&subscription).Error

	out.EnterpriseName = enterprise.Name
	out.BrandName = brand.Name
	out.Website = brand.OfficialDomain
	if subscription.ID != 0 {
		out.StartedAt = &subscription.StartsAt
		out.ExpiresAt = &subscription.ExpiresAt
	}

	// 4 统计卡（企业级聚合，复用 geo_monitor GetDashboard 的口径）
	// 注意：db.Table() 不自动过滤软删除，需显式加 deleted_at IS NULL。
	_ = db.Table(model.TableKeywords).Where("enterprise_id = ? AND deleted_at IS NULL AND status = 'active'", entID).Count(&out.KeywordCount).Error
	_ = db.Table(model.TableQuestions).Where("enterprise_id = ? AND status = ? AND deleted_at IS NULL", entID, biz.QuestionStatusApproved).Count(&out.TermCount).Error
	_ = db.Table(model.TableAnswerSnapshots+" AS s").
		Joins(dashboardLatestAnalysisJoin).
		Where("s.enterprise_id = ? AND s.answer_status = 'valid' AND analysis.brand_mentioned = TRUE", entID).
		Count(&out.TotalInclusion).Error
	_ = db.Table(model.TablePublishTasks).Where("enterprise_id = ? AND status = ? AND deleted_at IS NULL", entID, "succeeded").Count(&out.ArticleCount).Error

	// 品牌词标签：取该企业活跃关键词前 20（keywords 表无 metric 列，按 status=active 取品牌词标签）
	var keywords []model.Keyword
	_ = db.Where("enterprise_id = ? AND status = ?", entID, "active").Order("id ASC").Limit(20).Find(&keywords).Error
	out.BrandKeywords = make([]string, 0, len(keywords))
	for _, k := range keywords {
		out.BrandKeywords = append(out.BrandKeywords, k.Text)
	}
	return out, nil
}

// GetIndexTop 品牌可见度圆环（按平台分组）：
//   当 opts.PeriodType 非空时，按周/月范围查询（用于周报/月报平台明细）；
//   否则按当日范围查询（用于大盘首页品牌可见度圆环）。
//   recommendation = 品牌可见度 = SUM(brand_mentioned)/COUNT(*)*100
//                    （收录的 snapshot 数 / 全部 snapshot 数 × 100）
//   visibility_rate = 与 recommendation 相同（保留字段以兼容前端展示）
//   mention_count = 收录数 = SUM(brand_mentioned)（查收录中收录成功算一次，非提及次数）
//   inclusion_count = 兼容字段，与 mention_count 相同
//   sentiment = 该范围该平台主导情感（按 site_id, sentiment 分组取 count 最大者，
//               基于 geo_mentions 表按 snapshot 去重，回答级口径）
// 不再调用 LLM 做推荐度判定，避免浪费配额。
func (r *brandBoardRepo) GetIndexTop(ctx context.Context, entID uint64, opts biz.BrandBoardOptions) (*biz.BrandIndexTop, error) {
	db := r.data.DB(ctx)
	var dayFrom, dayTo time.Time
	if opts.PeriodType != "" {
		refDate := brandBoardParseDate(opts.PeriodDate)
		dayFrom, dayTo, _, _ = brandBoardPeriodRange(opts.PeriodType, refDate)
	} else {
		dayFrom, dayTo = brandBoardTodayRange()
	}
	var rows []struct {
		Platform       string  `gorm:"column:platform_name"`
		Recommendation int32   `gorm:"column:recommendation"`
		InclusionCount int64   `gorm:"column:inclusion_count"`
		VisibilityRate float64 `gorm:"column:visibility_rate"`
		MentionCount   int64   `gorm:"column:mention_count"`
	}
	_ = db.Table(model.TableAnswerSnapshots+" AS s").
		Joins(dashboardLatestAnalysisJoin).
		Joins("JOIN "+model.TableInclusionSites+" AS site ON site.id = s.inclusion_site_id").
		Select("site.name AS platform_name, "+
			"CAST(ROUND(SUM(analysis.brand_mentioned)/COUNT(*)*100) AS UNSIGNED) AS recommendation, "+
			"SUM(analysis.brand_mentioned) AS inclusion_count, "+
			"ROUND(SUM(analysis.brand_mentioned)/COUNT(*)*100, 2) AS visibility_rate, "+
			"SUM(analysis.brand_mentioned) AS mention_count").
		Where("s.enterprise_id = ? AND s.answer_status = 'valid' AND s.observed_at >= ? AND s.observed_at < ?", entID, dayFrom, dayTo).
		Group("s.inclusion_site_id, site.name").
		Order("inclusion_count DESC").
		Scan(&rows).Error

	// 按平台分组的主导情感（当日范围，只统计 brand/enterprise 类型 mention，排除 contact），
	// Go 层聚合得每平台主导情感（与 GetDashboard 全量口径相同，仅多了当日时间过滤）
	// 排序优先级：positive > negative > neutral（避免历史遗留 neutral 数据压过新 positive）
	var sentRows []struct {
		SiteID    uint64 `gorm:"column:site_id"`
		Sentiment string `gorm:"column:sentiment"`
		Count     int64  `gorm:"column:cnt"`
	}
	_ = db.Table(model.TableMentions+" AS m").
		Joins("JOIN "+model.TableAnswerSnapshots+" AS s ON s.id = m.answer_snapshot_id").
		Select("s.inclusion_site_id AS site_id, m.sentiment AS sentiment, COUNT(*) AS cnt").
		Where("s.enterprise_id = ? AND s.answer_status = 'valid' AND s.observed_at >= ? AND s.observed_at < ? AND "+brandMentionFilter, entID, dayFrom, dayTo).
		Group("s.inclusion_site_id, m.sentiment").
		Order("cnt DESC, FIELD(m.sentiment, 'positive', 'negative', 'neutral')").
		Scan(&sentRows).Error

	type siteSentiment struct {
		dominant string
		maxCount int64
	}
	siteMap := make(map[uint64]*siteSentiment, len(sentRows))
	for _, row := range sentRows {
		m := siteMap[row.SiteID]
		if m == nil {
			m = &siteSentiment{}
			siteMap[row.SiteID] = m
		}
		// 严格大于才更新（cnt 相同时保留 SQL 排序优先的 sentiment，
		// 即 positive > negative > neutral）
		if row.Count > m.maxCount {
			m.maxCount = row.Count
			m.dominant = row.Sentiment
		}
	}

	// 由于 visRows 没有返回 site_id，需要再查一次 site_id 映射（按 platform_name）
	var siteIDRows []struct {
		SiteID    uint64 `gorm:"column:site_id"`
		Platform  string `gorm:"column:platform_name"`
	}
	_ = db.Table(model.TableAnswerSnapshots+" AS s").
		Joins("JOIN "+model.TableInclusionSites+" AS site ON site.id = s.inclusion_site_id").
		Select("DISTINCT s.inclusion_site_id AS site_id, site.name AS platform_name").
		Where("s.enterprise_id = ? AND s.answer_status = 'valid' AND s.observed_at >= ? AND s.observed_at < ?", entID, dayFrom, dayTo).
		Scan(&siteIDRows).Error
	platformToSiteID := make(map[string]uint64, len(siteIDRows))
	for _, r := range siteIDRows {
		platformToSiteID[r.Platform] = r.SiteID
	}

	out := &biz.BrandIndexTop{Platforms: make([]*biz.BrandRecommendation, 0, len(rows))}
	for _, row := range rows {
		rec := &biz.BrandRecommendation{
			Platform:       row.Platform,
			Recommendation: row.Recommendation,
			InclusionCount: row.InclusionCount,
			VisibilityRate: row.VisibilityRate,
			MentionCount:   row.MentionCount,
		}
		if siteID, ok := platformToSiteID[row.Platform]; ok {
			if m, ok2 := siteMap[siteID]; ok2 {
				rec.Sentiment = m.dominant
			}
		}
		out.Platforms = append(out.Platforms, rec)
	}
	return out, nil
}

// GetDashboard 数据大盘（5 聚合指标 + 各平台分项），全量统计（不限日期）。
func (r *brandBoardRepo) GetDashboard(ctx context.Context, entID uint64) (*biz.BrandDashboard, error) {
	db := r.data.DB(ctx)
	out := &biz.BrandDashboard{}

	// 5 聚合指标之 4：对话轮次 / 收录次数 / 可见度 / TOP3 占位率
	var agg struct {
		DialogueRounds int64   `gorm:"column:dialogue_rounds"`
		InclusionCount int64   `gorm:"column:inclusion_count"`
		VisibilityRate float64 `gorm:"column:visibility_rate"`
		Top3Rate       float64 `gorm:"column:top3_rate"`
	}
	_ = db.Table(model.TableAnswerSnapshots+" AS s").
		Joins(dashboardLatestAnalysisJoin).
		Select("COUNT(*) AS dialogue_rounds, "+
			"SUM(analysis.brand_mentioned) AS inclusion_count, "+
			"ROUND(SUM(analysis.brand_mentioned)/COUNT(*)*100, 2) AS visibility_rate, "+
			"ROUND(SUM("+brandTop3CaseExpr+")/COUNT(*)*100, 2) AS top3_rate").
		Where("s.enterprise_id = ? AND s.answer_status = 'valid'", entID).
		Scan(&agg).Error
	out.DialogueRounds = agg.DialogueRounds
	out.VisibilityRate = agg.VisibilityRate
	out.Top3Rate = agg.Top3Rate

	// 提及次数（回答级口径：一条回答中出现 N 次只计 1 次，按 snapshot 去重，排除 contact）
	// + 正向情感率（同为回答级口径：正向收录数 / 提及次数）
	var mentionAgg struct {
		MentionCount int64   `gorm:"column:mention_count"`
		PositiveRate float64 `gorm:"column:positive_rate"`
	}
	snapshotSubquery := "SELECT id FROM " + model.TableAnswerSnapshots +
		" WHERE enterprise_id = ? AND answer_status = 'valid'"
	_ = db.Table(model.TableMentions+" AS m").
		Select("COUNT(DISTINCT m.answer_snapshot_id) AS mention_count, "+
			"ROUND(COUNT(DISTINCT CASE WHEN m.sentiment = 'positive' THEN m.answer_snapshot_id END)/COUNT(DISTINCT m.answer_snapshot_id)*100, 2) AS positive_rate").
		Where("m.answer_snapshot_id IN ("+snapshotSubquery+") AND "+brandMentionFilter, entID).
		Scan(&mentionAgg).Error
	out.MentionCount = mentionAgg.MentionCount
	out.PositiveRate = mentionAgg.PositiveRate

	// 各平台分项：可见率（snapshot+analysis 口径）+ 提及次数/主导情感（mentions 去重 snapshot 口径），按 site_id 合并
	var visRows []struct {
		SiteID         uint64  `gorm:"column:site_id"`
		Platform       string  `gorm:"column:platform_name"`
		VisibilityRate float64 `gorm:"column:visibility_rate"`
		InclusionCount int64   `gorm:"column:inclusion_count"`
	}
	_ = db.Table(model.TableAnswerSnapshots+" AS s").
		Joins(dashboardLatestAnalysisJoin).
		Joins("JOIN "+model.TableInclusionSites+" AS site ON site.id = s.inclusion_site_id").
		Select("s.inclusion_site_id AS site_id, site.name AS platform_name, "+
			"ROUND(SUM(analysis.brand_mentioned)/COUNT(*)*100, 2) AS visibility_rate, "+
			"SUM(analysis.brand_mentioned) AS inclusion_count").
		Where("s.enterprise_id = ? AND s.answer_status = 'valid'", entID).
		Group("s.inclusion_site_id, site.name").
		Scan(&visRows).Error

	// 提及次数按 (site_id, sentiment) 分组：回答级口径，一条回答只算 1 次（按 snapshot 去重）
	var sentRows []struct {
		SiteID    uint64 `gorm:"column:site_id"`
		Sentiment string `gorm:"column:sentiment"`
		Count     int64  `gorm:"column:cnt"`
	}
	_ = db.Table(model.TableMentions+" AS m").
		Joins("JOIN "+model.TableAnswerSnapshots+" AS s ON s.id = m.answer_snapshot_id").
		Select("s.inclusion_site_id AS site_id, m.sentiment AS sentiment, COUNT(DISTINCT m.answer_snapshot_id) AS cnt").
		Where("s.enterprise_id = ? AND s.answer_status = 'valid' AND "+brandMentionFilter, entID).
		Group("s.inclusion_site_id, m.sentiment").
		Scan(&sentRows).Error

	type siteMention struct {
		total    int64
		dominant string
		maxCount int64
	}
	siteMap := make(map[uint64]*siteMention, len(sentRows))
	for _, row := range sentRows {
		m := siteMap[row.SiteID]
		if m == nil {
			m = &siteMention{}
			siteMap[row.SiteID] = m
		}
		m.total += row.Count
		if row.Count > m.maxCount {
			m.maxCount = row.Count
			m.dominant = row.Sentiment
		}
	}

	out.Platforms = make([]*biz.BrandPlatformStat, 0, len(visRows))
	for _, v := range visRows {
		stat := &biz.BrandPlatformStat{
			Platform:       v.Platform,
			VisibilityRate: v.VisibilityRate,
			InclusionCount: v.InclusionCount,
		}
		if m, ok := siteMap[v.SiteID]; ok {
			stat.MentionCount = m.total
			stat.Sentiment = m.dominant
		}
		out.Platforms = append(out.Platforms, stat)
	}
	return out, nil
}

// GetIndexMain 主区数据（3 趋势折线 + 情感倾向表），range 参数控制分桶。
// 当 opts.PeriodType 非空时，使用周/月范围（由 brandBoardPeriodRange 计算）。
func (r *brandBoardRepo) GetIndexMain(ctx context.Context, entID uint64, opts biz.BrandBoardOptions) (*biz.BrandIndexMain, error) {
	db := r.data.DB(ctx)
	out := &biz.BrandIndexMain{}

	// 确定时间范围和分桶格式
	var from, to time.Time
	var bucketFmt string
	if opts.PeriodType != "" {
		refDate := brandBoardParseDate(opts.PeriodDate)
		from, to, _, _ = brandBoardPeriodRange(opts.PeriodType, refDate)
		bucketFmt = "%Y-%m-%d"
	} else {
		from, to = dashboardRange(opts.Range)
		bucketFmt = dashboardTrendFormat(opts.Range)
	}

	// 1. 收录趋势：brand_mentioned=true 计数，按日/月分桶
	var inclusionRows []struct {
		Bucket string `gorm:"column:bucket"`
		Value  int64  `gorm:"column:value"`
	}
	_ = db.Table(model.TableAnswerSnapshots+" AS s").
		Joins(dashboardLatestAnalysisJoin).
		Select("DATE_FORMAT(DATE_ADD(s.observed_at, INTERVAL 8 HOUR), ?) AS bucket, SUM(analysis.brand_mentioned) AS value", bucketFmt).
		Where("s.enterprise_id = ? AND s.answer_status = 'valid' AND s.observed_at >= ? AND s.observed_at < ?", entID, from, to).
		Group("bucket").
		Scan(&inclusionRows).Error
	inclusionMap := make(map[string]int64, len(inclusionRows))
	for _, row := range inclusionRows {
		inclusionMap[row.Bucket] = row.Value
	}

	// 2. 可见度趋势：收录率（SUM(brand_mentioned)/COUNT(*)*100）
	var visRows []struct {
		Bucket string  `gorm:"column:bucket"`
		Rate   float64 `gorm:"column:rate"`
	}
	_ = db.Table(model.TableAnswerSnapshots+" AS s").
		Joins(dashboardLatestAnalysisJoin).
		Select("DATE_FORMAT(DATE_ADD(s.observed_at, INTERVAL 8 HOUR), ?) AS bucket, ROUND(SUM(analysis.brand_mentioned)/COUNT(*)*100, 2) AS rate", bucketFmt).
		Where("s.enterprise_id = ? AND s.answer_status = 'valid' AND s.observed_at >= ? AND s.observed_at < ?", entID, from, to).
		Group("bucket").
		Scan(&visRows).Error
	visMap := make(map[string]float64, len(visRows))
	for _, row := range visRows {
		visMap[row.Bucket] = row.Rate
	}

	// 3. 提及次数趋势：回答级别，一条回答只算 1 次（按 snapshot 去重，排除 contact）
	var mentionRows []struct {
		Bucket string `gorm:"column:bucket"`
		Value  int64  `gorm:"column:value"`
	}
	_ = db.Table(model.TableMentions+" AS m").
		Joins("JOIN "+model.TableAnswerSnapshots+" AS s ON s.id = m.answer_snapshot_id").
		Select("DATE_FORMAT(DATE_ADD(s.observed_at, INTERVAL 8 HOUR), ?) AS bucket, COUNT(DISTINCT m.answer_snapshot_id) AS value", bucketFmt).
		Where("s.enterprise_id = ? AND s.answer_status = 'valid' AND s.observed_at >= ? AND s.observed_at < ? AND "+brandMentionFilter, entID, from, to).
		Group("bucket").
		Scan(&mentionRows).Error
	mentionMap := make(map[string]int64, len(mentionRows))
	for _, row := range mentionRows {
		mentionMap[row.Bucket] = row.Value
	}

	// 趋势补零生成完整序列
	out.InclusionTrend = buildBrandTrendSeries(opts.Range, from, to, inclusionMap, nil)
	out.VisibilityTrend = buildBrandTrendSeries(opts.Range, from, to, nil, visMap)
	out.MentionTrend = buildBrandTrendSeries(opts.Range, from, to, mentionMap, nil)

	// 4. 情感倾向 3 档：按 snapshot 维度统计（与"收录总量"口径完全对齐）。
	// 一个收录的 snapshot 调用一次 LLM 得到一个 sentiment 值，可能写入多条
	// brand/enterprise mention（sentiment 相同）；按 mention 行数统计会重复。
	// 这里以 snapshot 为主表 JOIN latest_analysis，LEFT JOIN mentions 取每条
	// snapshot 的 sentiment；未跑情感分析的 snapshot（sentiment 为 NULL）归入 neutral。
	// 不加时间范围限制，确保各档 count 之和 = "收录总量"（companyInfo.TotalInclusion）。
	sentimentExpr := "COALESCE(m.sentiment, 'neutral')"
	var sentRows []struct {
		Sentiment string `gorm:"column:sentiment"`
		Count     int64  `gorm:"column:cnt"`
	}
	_ = db.Table(model.TableAnswerSnapshots+" AS s").
		Joins(dashboardLatestAnalysisJoin).
		Joins("LEFT JOIN "+model.TableMentions+" AS m ON m.answer_snapshot_id = s.id AND "+brandMentionFilter).
		Select(sentimentExpr+" AS sentiment, COUNT(DISTINCT s.id) AS cnt").
		Where("s.enterprise_id = ? AND s.answer_status = 'valid' AND analysis.brand_mentioned = TRUE", entID).
		Group(sentimentExpr).
		Scan(&sentRows).Error
	var total int64
	for _, row := range sentRows {
		total += row.Count
	}
	out.Sentiment = make([]*biz.BrandSentimentStat, 0, len(sentRows))
	for _, row := range sentRows {
		stat := &biz.BrandSentimentStat{Sentiment: row.Sentiment, Count: row.Count}
		if total > 0 {
			stat.Rate = float64(row.Count) / float64(total) * 100
		}
		out.Sentiment = append(out.Sentiment, stat)
	}
	return out, nil
}

// GetIndexBottom 舆情分析（周/月结）。
// 实现已迁移至 opinion_summary.go：读 geo_opinion_summaries 离线总结表。

// GetSummary 周月报摘要：周期环比（visibility/inclusion/mention）+ 按问题词条聚合。
// period=week 取近 7 天，month 取当月；上期为对应前一段。
func (r *brandBoardRepo) GetSummary(ctx context.Context, entID uint64, period string, refDate time.Time) (*biz.BrandSummary, error) {
	db := r.data.DB(ctx)
	out := &biz.BrandSummary{PeriodType: period}

	currFrom, currTo, prevFrom, prevTo := brandBoardPeriodRange(period, refDate)
	out.PeriodStart = currFrom.In(dashboardLoc).Format("2006-01-02")
	out.PeriodEnd = currTo.In(dashboardLoc).Format("2006-01-02")

	// 本期 visibility + inclusion
	var currAgg struct {
		VisibilityRate float64 `gorm:"column:visibility_rate"`
		InclusionCount int64   `gorm:"column:inclusion_count"`
	}
	_ = db.Table(model.TableAnswerSnapshots+" AS s").
		Joins(dashboardLatestAnalysisJoin).
		Select("ROUND(SUM(analysis.brand_mentioned)/COUNT(*)*100, 2) AS visibility_rate, "+
			"SUM(analysis.brand_mentioned) AS inclusion_count").
		Where("s.enterprise_id = ? AND s.answer_status = 'valid' AND s.observed_at >= ? AND s.observed_at < ?", entID, currFrom, currTo).
		Scan(&currAgg).Error
	out.VisibilityRate = currAgg.VisibilityRate
	out.TotalInclusion = currAgg.InclusionCount

	// 上周期 visibility + inclusion（环比基准）
	var prevAgg struct {
		VisibilityRate float64 `gorm:"column:visibility_rate"`
		InclusionCount int64   `gorm:"column:inclusion_count"`
	}
	_ = db.Table(model.TableAnswerSnapshots+" AS s").
		Joins(dashboardLatestAnalysisJoin).
		Select("ROUND(SUM(analysis.brand_mentioned)/COUNT(*)*100, 2) AS visibility_rate, "+
			"SUM(analysis.brand_mentioned) AS inclusion_count").
		Where("s.enterprise_id = ? AND s.answer_status = 'valid' AND s.observed_at >= ? AND s.observed_at < ?", entID, prevFrom, prevTo).
		Scan(&prevAgg).Error
	// 可见度环比：上期为0时无意义，用 -1 标记前端显示"-"
	if prevAgg.VisibilityRate > 0 {
		out.VisibilityDelta = currAgg.VisibilityRate - prevAgg.VisibilityRate
	} else {
		out.VisibilityDelta = -1
	}
	// 收录总量环比：上期为0时不计算百分比，用 -1 标记前端显示"-"
	if prevAgg.InclusionCount > 0 {
		out.InclusionDelta = int64(math.Round(float64(currAgg.InclusionCount-prevAgg.InclusionCount) / float64(prevAgg.InclusionCount) * 100))
	} else {
		out.InclusionDelta = -1
	}

	// 本期 + 上期提及次数（品牌名/企业名称，排除 contact）
	// 口径：回答级，一条回答中出现 N 次只计 1 次（按 snapshot 去重）
	var currMention, prevMention int64
	var mentionAgg struct {
		Cnt int64 `gorm:"column:cnt"`
	}
	_ = db.Table(model.TableMentions+" AS m").
		Joins("JOIN "+model.TableAnswerSnapshots+" AS s ON s.id = m.answer_snapshot_id").
		Select("COUNT(DISTINCT m.answer_snapshot_id) AS cnt").
		Where("s.enterprise_id = ? AND s.answer_status = 'valid' AND s.observed_at >= ? AND s.observed_at < ? AND "+brandMentionFilter, entID, currFrom, currTo).
		Scan(&mentionAgg).Error
	currMention = mentionAgg.Cnt
	_ = db.Table(model.TableMentions+" AS m").
		Joins("JOIN "+model.TableAnswerSnapshots+" AS s ON s.id = m.answer_snapshot_id").
		Select("COUNT(DISTINCT m.answer_snapshot_id) AS cnt").
		Where("s.enterprise_id = ? AND s.answer_status = 'valid' AND s.observed_at >= ? AND s.observed_at < ? AND "+brandMentionFilter, entID, prevFrom, prevTo).
		Scan(&mentionAgg).Error
	prevMention = mentionAgg.Cnt
	out.MentionCount = currMention
	// 提及次数环比：上期为0时不计算百分比，用 -1 标记前端显示"-"
	if prevMention > 0 {
		out.MentionDelta = int64(math.Round(float64(currMention-prevMention) / float64(prevMention) * 100))
	} else {
		out.MentionDelta = -1
	}

	// 本期 + 上期 TOP3 占位率
	var currTop3, prevTop3 struct {
		Rate float64 `gorm:"column:top3_rate"`
	}
	_ = db.Table(model.TableAnswerSnapshots+" AS s").
		Joins(dashboardLatestAnalysisJoin).
		Select("ROUND(SUM("+brandTop3CaseExpr+")/COUNT(*)*100, 2) AS top3_rate").
		Where("s.enterprise_id = ? AND s.answer_status = 'valid' AND s.observed_at >= ? AND s.observed_at < ?", entID, currFrom, currTo).
		Scan(&currTop3).Error
	_ = db.Table(model.TableAnswerSnapshots+" AS s").
		Joins(dashboardLatestAnalysisJoin).
		Select("ROUND(SUM("+brandTop3CaseExpr+")/COUNT(*)*100, 2) AS top3_rate").
		Where("s.enterprise_id = ? AND s.answer_status = 'valid' AND s.observed_at >= ? AND s.observed_at < ?", entID, prevFrom, prevTo).
		Scan(&prevTop3).Error
	out.Top3Rate = currTop3.Rate
	// TOP3 环比：上期为0时无意义，用 -1 标记
	if prevTop3.Rate > 0 {
		out.Top3RateDelta = currTop3.Rate - prevTop3.Rate
	} else {
		out.Top3RateDelta = -1
	}

	// 按问题词条聚合（brand_mentioned=true）：全期 total + 本期 period_count，两查询合并
	var totalRows []struct {
		Question   string `gorm:"column:question"`
		TotalCount int64  `gorm:"column:total_count"`
	}
	_ = db.Table(model.TableAnswerSnapshots+" AS s").
		Joins(dashboardLatestAnalysisJoin).
		Joins("JOIN "+model.TableGEOTasks+" AS task ON task.id = s.geo_task_id").
		Joins("JOIN "+model.TableQuestions+" AS q ON q.id = task.question_id").
		Select("q.text AS question, COUNT(*) AS total_count").
		Where("s.enterprise_id = ? AND s.answer_status = 'valid' AND analysis.brand_mentioned = TRUE", entID).
		Group("q.id, q.text").
		Scan(&totalRows).Error

	var periodRows []struct {
		Question    string `gorm:"column:question"`
		PeriodCount int64  `gorm:"column:period_count"`
	}
	_ = db.Table(model.TableAnswerSnapshots+" AS s").
		Joins(dashboardLatestAnalysisJoin).
		Joins("JOIN "+model.TableGEOTasks+" AS task ON task.id = s.geo_task_id").
		Joins("JOIN "+model.TableQuestions+" AS q ON q.id = task.question_id").
		Select("q.text AS question, COUNT(*) AS period_count").
		Where("s.enterprise_id = ? AND s.answer_status = 'valid' AND analysis.brand_mentioned = TRUE AND s.observed_at >= ? AND s.observed_at < ?", entID, currFrom, currTo).
		Group("q.id, q.text").
		Scan(&periodRows).Error

	periodMap := make(map[string]int64, len(periodRows))
	for _, row := range periodRows {
		periodMap[row.Question] = row.PeriodCount
	}
	out.Questions = make([]*biz.BrandQuestionStat, 0, len(totalRows))
	for _, row := range totalRows {
		out.Questions = append(out.Questions, &biz.BrandQuestionStat{
			Question:    row.Question,
			TotalCount:  row.TotalCount,
			PeriodCount: periodMap[row.Question],
		})
	}
	return out, nil
}

// ============================================================
// 优化记录：ListBrandRecords + GetBrandOptimizeStats
// ============================================================

// ListBrandRecords 优化记录分页查询。
func (r *brandBoardRepo) ListBrandRecords(ctx context.Context, entID uint64, q biz.BrandRecordQuery) (*biz.BrandRecordsPage, error) {
	db := r.data.DB(ctx)
	out := &biz.BrandRecordsPage{}

	pageSize := int(q.PageSize)
	if pageSize <= 0 || pageSize > 50 {
		pageSize = 10
	}

	offset := 0
	if q.PageToken != "" {
		if n, err := strconv.Atoi(q.PageToken); err == nil && n > 0 {
			offset = n
		}
	}

	baseWhere := "s.enterprise_id = ? AND s.answer_status = 'valid' AND analysis.brand_mentioned = TRUE"
	args := []interface{}{entID}

	if q.InclusionSiteID > 0 {
		baseWhere += " AND s.inclusion_site_id = ?"
		args = append(args, q.InclusionSiteID)
	}
	if q.Keyword != "" {
		baseWhere += " AND q.text LIKE ?"
		args = append(args, "%"+q.Keyword+"%")
	}
	if q.SentimentFilter != "" {
		baseWhere += " AND m.sentiment = ?"
		args = append(args, q.SentimentFilter)
	}

	// 总数（按 snapshot 计数，与列表分组一致：一条回答一行）
	var total int64
	totalQuery := db.Table(model.TableAnswerSnapshots+" AS s").
		Joins(dashboardLatestAnalysisJoin).
		Joins("JOIN "+model.TableGEOTasks+" AS task ON task.id = s.geo_task_id").
		Joins("JOIN "+model.TableQuestions+" AS q ON q.id = task.question_id")
	if q.SentimentFilter != "" {
		totalQuery = totalQuery.Joins("LEFT JOIN " + model.TableMentions + " AS m ON m.answer_snapshot_id = s.id AND " + brandMentionFilter)
	}
	_ = totalQuery.Where(baseWhere, args...).Count(&total).Error
	out.TotalSize = total

	type recordRow struct {
		ID            uint64    `gorm:"column:id"`
		Keyword       string    `gorm:"column:keyword"`
		Question      string    `gorm:"column:question"`
		Platform      string    `gorm:"column:platform"`
		PlatformIcon  string    `gorm:"column:platform_icon"`
		BrandMentioned bool     `gorm:"column:brand_mentioned"`
		BrandRank     int32     `gorm:"column:brand_rank"`
		Sentiment     string    `gorm:"column:sentiment"`
		TerminalType  int32     `gorm:"column:terminal_type"`
		ObservedAt    time.Time `gorm:"column:observed_at"`
		SessionRef    string    `gorm:"column:session_ref"`
		TaskStatus    string    `gorm:"column:task_status"`
		MentionCount  int64     `gorm:"column:mention_count"`
		ContactExposed bool     `gorm:"column:contact_exposed"`
	}

	var rows []recordRow
	// 一条回答一行：sentiment 按优先级聚合（negative > positive > neutral）。
	// 用 MIN(CASE 数值映射) 取最高优先级，再用 ELT 还原字符串。
	err := db.Table(model.TableAnswerSnapshots+" AS s").
		Joins(dashboardLatestAnalysisJoin).
		Joins("JOIN "+model.TableGEOTasks+" AS task ON task.id = s.geo_task_id").
		Joins("JOIN "+model.TableQuestions+" AS q ON q.id = task.question_id").
		Joins("LEFT JOIN "+model.TableKeywords+" AS kw ON kw.id = q.keyword_id").
		Joins("LEFT JOIN "+model.TableInclusionSites+" AS site ON site.id = s.inclusion_site_id").
		Joins("LEFT JOIN "+model.TableMentions+" AS m ON m.answer_snapshot_id = s.id AND "+brandMentionFilter).
		Select(
			"s.id AS id, kw.text AS keyword, q.text AS question, site.name AS platform, site.icon AS platform_icon, "+
				"COALESCE(analysis.brand_mentioned, 0) AS brand_mentioned, "+
				"COALESCE(JSON_EXTRACT(analysis.result_json, '$.brandRank'), 0) AS brand_rank, "+
				"ELT(MIN(CASE m.sentiment WHEN 'negative' THEN 1 WHEN 'positive' THEN 2 ELSE 3 END), 'negative', 'positive', 'neutral') AS sentiment, "+
				"task.terminal_type AS terminal_type, s.observed_at AS observed_at, "+
				"s.session_ref AS session_ref, task.status AS task_status, "+
				"COUNT(DISTINCT m.answer_snapshot_id) AS mention_count, "+
				"EXISTS(SELECT 1 FROM "+model.TableMentions+" AS cm WHERE cm.answer_snapshot_id = s.id AND cm.entity_type = 'contact') AS contact_exposed",
		).
		Where(baseWhere, args...).
		Group("s.id, kw.text, q.text, site.name, site.icon, analysis.brand_mentioned, analysis.result_json, task.terminal_type, s.observed_at, s.session_ref, task.status").
		Order("s.observed_at DESC").
		Offset(offset).
		Limit(pageSize).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	for _, row := range rows {
		out.Records = append(out.Records, &biz.BrandRecord{
			ID:           row.ID,
			Keyword:      row.Keyword,
			Question:     row.Question,
			Platform:     row.Platform,
			PlatformIcon: row.PlatformIcon,
			Included:     row.BrandMentioned,
			MentionCount: row.MentionCount,
			BrandRank:    row.BrandRank,
			Sentiment:    row.Sentiment,
			TerminalType: row.TerminalType,
			ObservedAt:   row.ObservedAt,
			SessionRef:   row.SessionRef,
			TaskStatus:   row.TaskStatus,
			ContactExposed: row.ContactExposed,
		})
	}

	if offset+pageSize < int(total) {
		out.NextPageToken = strconv.Itoa(offset + pageSize)
	}

	return out, nil
}

// GetBrandOptimizeStats 优化统计卡（6 统计）。
func (r *brandBoardRepo) GetBrandOptimizeStats(ctx context.Context, entID uint64) (*biz.BrandOptimizeStats, error) {
	db := r.data.DB(ctx)
	out := &biz.BrandOptimizeStats{}

	// 服务周期
	var sub struct {
		StartedAt *time.Time `gorm:"column:started_at"`
		ExpiresAt *time.Time `gorm:"column:expires_at"`
	}
	_ = db.Table("ent_subscriptions").
		Select("starts_at AS started_at, expires_at AS expires_at").
		Where("enterprise_id = ? AND status = 'active'", entID).
		Order("starts_at ASC").
		Limit(1).
		Scan(&sub).Error

	now := time.Now()
	if sub.StartedAt != nil {
		// 用北京时间日期差计算，同一天算1天
		startLocal := sub.StartedAt.In(dashboardLoc)
		nowLocal := now.In(dashboardLoc)
		startDate := time.Date(startLocal.Year(), startLocal.Month(), startLocal.Day(), 0, 0, 0, 0, dashboardLoc)
		todayDate := time.Date(nowLocal.Year(), nowLocal.Month(), nowLocal.Day(), 0, 0, 0, 0, dashboardLoc)
		days := int64(todayDate.Sub(startDate).Hours() / 24)
		if days >= 0 {
			out.TotalOptimizeDays = days + 1 // 同一天算1天
		}
	}
	if sub.ExpiresAt != nil {
		remaining := int64(sub.ExpiresAt.Sub(now).Hours() / 24)
		if remaining < 0 {
			remaining = 0
		}
		out.RemainingDays = remaining
	}

	// 累计达标天数
	var qualifiedDays int64
	_ = db.Table(model.TableAnswerSnapshots+" AS s").
		Joins(dashboardLatestAnalysisJoin).
		Select("COUNT(DISTINCT DATE(DATE_ADD(s.observed_at, INTERVAL 8 HOUR))) AS cnt").
		Where("s.enterprise_id = ? AND s.answer_status = 'valid' AND analysis.brand_mentioned = TRUE", entID).
		Scan(&qualifiedDays).Error
	out.TotalQualifiedDays = qualifiedDays

	// 今日统计
	nowLocal := now.In(dashboardLoc)
	todayStart := time.Date(nowLocal.Year(), nowLocal.Month(), nowLocal.Day(), 0, 0, 0, 0, dashboardLoc).UTC()
	todayEnd := todayStart.Add(24 * time.Hour)

	var todayAgg struct {
		Total    int64 `gorm:"column:total"`
		PCCount  int64 `gorm:"column:pc_count"`
		MobCount int64 `gorm:"column:mob_count"`
	}
	_ = db.Table(model.TableAnswerSnapshots+" AS s").
		Joins(dashboardLatestAnalysisJoin).
		Joins("JOIN "+model.TableGEOTasks+" AS task ON task.id = s.geo_task_id").
		Select("COUNT(*) AS total, " +
			"SUM(CASE WHEN task.terminal_type = 1 THEN 1 ELSE 0 END) AS pc_count, " +
			"SUM(CASE WHEN task.terminal_type = 2 THEN 1 ELSE 0 END) AS mob_count").
		Where("s.enterprise_id = ? AND analysis.brand_mentioned = TRUE AND s.observed_at >= ? AND s.observed_at < ?", entID, todayStart, todayEnd).
		Scan(&todayAgg).Error
	out.TodayInclusion = todayAgg.Total
	out.TodayPCInclusion = todayAgg.PCCount
	out.TodayMobileInclusion = todayAgg.MobCount

	return out, nil
}

// GetSourceAnalysis 返回信源分析聚合数据。
func (r *brandBoardRepo) GetSourceAnalysis(ctx context.Context, entID uint64, rng string) (*biz.BrandSourceAnalysis, error) {
	db := r.data.DB(ctx)
	out := &biz.BrandSourceAnalysis{}

	// 1. 文章发布总量（pub_tasks status=succeeded）
	var publishCount int64
	_ = db.Table(model.TablePublishTasks+" AS pt").
		Where("pt.enterprise_id = ? AND pt.status = ? AND pt.deleted_at IS NULL", entID, "succeeded").
		Count(&publishCount).Error
	out.ArticlePublishCount = publishCount

	// 2. 文章引用量（geo_citations article_id IS NOT NULL，关联同企业）
	// 2. 文章引用量（去重：同一问答同一文章最多计1次，对齐盘古设计）
	var citationCount int64
	_ = db.Table(model.TableCitations+" AS c").
		Joins("JOIN "+model.TableAnswerSnapshots+" AS s ON s.id = c.answer_snapshot_id").
		Where("s.enterprise_id = ? AND c.article_id IS NOT NULL", entID).
		Distinct("CONCAT(c.answer_snapshot_id, '-', c.article_id)").
		Count(&citationCount).Error
	out.ArticleCitationCount = citationCount

	// 3. 引用信源量（所有引用记录总数：系统发布文章被引用 + AI回答引用的外部信源）
	var sourceCount int64
	_ = db.Table(model.TableCitations+" AS c").
		Joins("JOIN "+model.TableAnswerSnapshots+" AS s ON s.id = c.answer_snapshot_id").
		Where("s.enterprise_id = ?", entID).
		Count(&sourceCount).Error
	out.SourceReferenceCount = sourceCount

	// 4. 媒体文章分布（按发布渠道 category：1=自媒体 2=官方媒体 3=KOL）
	// 字段命名沿用历史，实际语义以注释为准：
	//   self_media        = 自媒体
	//   commercial_media  = 官方媒体
	//   official_kb       = KOL
	out.MediaBreakdown = &biz.MediaArticleBreakdown{}
	var mediaAgg struct {
		Total    int64 `gorm:"column:total"`
		SelfMed  int64 `gorm:"column:self_media"`
		CommMed  int64 `gorm:"column:commercial_media"`
		OffKB   int64 `gorm:"column:official_kb"`
	}
	_ = db.Table(model.TablePublishTasks+" AS pt").
		Joins("JOIN "+model.TablePublishChannels+" AS pc ON pc.id = pt.publish_channel_id").
		Select("COUNT(*) AS total, " +
			"SUM(CASE WHEN pc.category = 1 THEN 1 ELSE 0 END) AS self_media, " +
			"SUM(CASE WHEN pc.category = 2 THEN 1 ELSE 0 END) AS commercial_media, " +
			"SUM(CASE WHEN pc.category = 3 THEN 1 ELSE 0 END) AS official_kb").
		Where("pt.enterprise_id = ? AND pt.status = ? AND pt.deleted_at IS NULL", entID, "succeeded").
		Scan(&mediaAgg).Error
	out.MediaBreakdown.Total = mediaAgg.Total
	out.MediaBreakdown.SelfMediaCount = mediaAgg.SelfMed
	out.MediaBreakdown.CommercialMediaCount = mediaAgg.CommMed
	out.MediaBreakdown.OfficialKBCount = mediaAgg.OffKB

	// 5. Top10 文章引用排行（去重：同一问答同一文章只计1次；关联 pub_tasks 取发布后的外部 URL）
	// 临时方案：当无引用数据时，展示最近发布的文章（citation_count=0）供预览效果
	type topArticleRow struct {
		Title         string `gorm:"column:title"`
		CitationCount int64  `gorm:"column:citation_count"`
		ArticleID     uint64 `gorm:"column:article_id"`
		ResultURL     string `gorm:"column:result_url"`
	}
	// 过滤平台管理页面 URL，只保留真正的文章链接
	urlFilter := `pt.result_url NOT LIKE '%om.qq.com/main/%'
		AND pt.result_url NOT LIKE '%mp.sohu.com/mpfe/%'
		AND pt.result_url NOT LIKE '%/contentManagement/%'
		AND pt.result_url NOT LIKE '%/addarticle%'
		AND pt.result_url NOT LIKE '%baijiahao.baidu.com/builder/%'
		AND pt.result_url NOT LIKE '%mp.163.com/subscribe%'
		AND pt.result_url NOT LIKE '%mp.toutiao.com/profile_v4%'
		AND pt.result_url NOT LIKE '%passport.csdn.net%'
		AND pt.result_url NOT LIKE 'https://weibo.com/'
		AND pt.result_url != '' AND pt.result_url IS NOT NULL`

	var topArticles []topArticleRow
	_ = db.Table(model.TableCitations+" AS c").
		Joins("JOIN "+model.TableAnswerSnapshots+" AS s ON s.id = c.answer_snapshot_id").
		Joins("JOIN "+model.TableArticles+" AS a ON a.id = c.article_id").
		Joins("LEFT JOIN "+model.TablePublishTasks+" AS pt ON pt.article_id = a.id AND pt.enterprise_id = s.enterprise_id AND pt.status = 'succeeded' AND pt.deleted_at IS NULL AND "+urlFilter).
		Select("a.title AS title, COUNT(DISTINCT s.id) AS citation_count, a.id AS article_id, MAX(pt.result_url) AS result_url").
		Where("s.enterprise_id = ? AND c.article_id IS NOT NULL", entID).
		Group("a.id, a.title").
		Order("citation_count DESC").
		Limit(10).
		Scan(&topArticles).Error

	// 无引用数据时返回空（前端显示"暂无文章引用数据"）
	for i, row := range topArticles {
		out.TopArticles = append(out.TopArticles, &biz.SourceArticleStat{
			Rank:          int32(i + 1),
			Title:         row.Title,
			CitationCount: row.CitationCount,
			ArticleID:     row.ArticleID,
			URL:           row.ResultURL,
		})
	}

	// 6. 文章发布趋势（按日期分桶）
	from, to := dashboardRange(rng)
	trendFmt := dashboardTrendFormat(rng)
	type trendRow struct {
		Bucket string `gorm:"column:bucket"`
		Count  int64  `gorm:"column:cnt"`
	}
	var trendRows []trendRow
	_ = db.Table(model.TablePublishTasks+" AS pt").
		Select("DATE_FORMAT(DATE_ADD(pt.completed_at, INTERVAL 8 HOUR), '" + trendFmt + "') AS bucket, COUNT(*) AS cnt").
		Where("pt.enterprise_id = ? AND pt.status = ? AND pt.completed_at >= ? AND pt.completed_at <= ? AND pt.deleted_at IS NULL",
			entID, "succeeded", from, to).
		Group("bucket").
		Order("bucket ASC").
		Scan(&trendRows).Error
	trendMap := make(map[string]int64, len(trendRows))
	for _, r := range trendRows {
		trendMap[r.Bucket] = r.Count
	}
	out.PublishTrend = buildArticlePublishTrendSeries(rng, from, to, trendMap)

	// 7. Top10 信源平台分布（带 site_name 用于前端显示中文名）
	type topSourceRow struct {
		Domain        string `gorm:"column:domain"`
		Title         string `gorm:"column:title"`
		CitationCount int64  `gorm:"column:citation_count"`
	}
	var topSources []topSourceRow
	_ = db.Table(model.TableCitations+" AS c").
		Joins("JOIN "+model.TableAnswerSnapshots+" AS s ON s.id = c.answer_snapshot_id").
		Select("c.domain AS domain, MAX(c.title) AS title, COUNT(*) AS citation_count").
		Where("s.enterprise_id = ?", entID).
		Group("c.domain").
		Order("citation_count DESC").
		Limit(10).
		Scan(&topSources).Error

	// 从 cfg_system_settings 读取域名→中文名映射（管理员可维护，非硬编码）
	nameMap := loadCitationDomainNames(db)
	for i, row := range topSources {
		// 三级匹配，对齐盘古 title ?? domain 的展示效果：
		// ① 配置表精确命中 / 去子域名前缀命中 → 用配置中文名
		// ② 未命中 → 用收录抓取时存的链接文本 title（经清洗后取站点名）
		// ③ title 清洗结果为空 → 回退原始域名
		siteName := lookupDomainName(row.Domain, nameMap)
		if siteName == "" {
			if sn := extractSiteName(row.Title); sn != "" {
				siteName = sn
			} else {
				siteName = row.Domain
			}
		}
		out.TopSourcePlatforms = append(out.TopSourcePlatforms, &biz.SourcePlatformStat{
			Rank:          int32(i + 1),
			Domain:        row.Domain,
			Title:         siteName,
			CitationCount: row.CitationCount,
		})
	}

	return out, nil
}

// buildArticlePublishTrendSeries 生成完整的文章发布趋势日期序列，缺失日期补 0。
func buildArticlePublishTrendSeries(r string, from, to time.Time, trendMap map[string]int64) []*biz.ArticlePublishTrendPoint {
	var points []*biz.ArticlePublishTrendPoint
	fromLocal := from.In(dashboardLoc)
	toLocal := to.In(dashboardLoc)
	if r == "year" {
		year := fromLocal.Year()
		for m := 1; m <= 12; m++ {
			bucket := time.Date(year, time.Month(m), 1, 0, 0, 0, 0, dashboardLoc).Format("2006-01")
			points = append(points, &biz.ArticlePublishTrendPoint{
				Date:  bucket,
				Count: trendMap[bucket],
			})
		}
		return points
	}
	for d := time.Date(fromLocal.Year(), fromLocal.Month(), fromLocal.Day(), 0, 0, 0, 0, dashboardLoc); !d.After(toLocal); d = d.AddDate(0, 0, 1) {
		bucket := d.Format("2006-01-02")
		points = append(points, &biz.ArticlePublishTrendPoint{
			Date:  bucket,
			Count: trendMap[bucket],
		})
	}
	return points
}

// citationDomainNameCache 域名→中文名映射缓存（进程级 TTL，与计费配置同模式）。
var citationDomainNameCache struct {
	sync.RWMutex
	loadedAt time.Time
	nameMap  map[string]string
}

// loadCitationDomainNames 从 cfg_system_settings 读取域名→中文名映射。
// namespace=citation, key_name=domain_names, value_json 为 {"domain": "中文名"} 格式。
// 管理员可在后台系统设置页面维护此配置，无需改代码。TTL 5 分钟自动刷新。
func loadCitationDomainNames(tx *gorm.DB) map[string]string {
	citationDomainNameCache.RLock()
	if !citationDomainNameCache.loadedAt.IsZero() && time.Since(citationDomainNameCache.loadedAt) < 5*time.Minute {
		m := citationDomainNameCache.nameMap
		citationDomainNameCache.RUnlock()
		return m
	}
	citationDomainNameCache.RUnlock()

	var setting model.SystemSetting
	nameMap := make(map[string]string)
	if err := tx.Where("namespace = ? AND key_name = ?", "citation", "domain_names").First(&setting).Error; err != nil {
		if stderrors.Is(err, gorm.ErrRecordNotFound) {
			// 未配置，返回空 map
		} else {
			return nameMap
		}
	} else {
		_ = json.Unmarshal(setting.ValueJSON, &nameMap)
	}

	citationDomainNameCache.Lock()
	citationDomainNameCache.nameMap = nameMap
	citationDomainNameCache.loadedAt = time.Now()
	citationDomainNameCache.Unlock()
	return nameMap
}

// lookupDomainName 在域名→中文名映射表中查找匹配的站点名。
// 查找顺序：
//  1. 配置表精确匹配（如 baijiahao.baidu.com → 百家号）
//  2. 配置表去子域名前缀匹配（如 m.baidu.com → baidu.com → 百度）
// 未匹配返回空字符串，由调用方回退到 extractSiteName 或原始域名。
func lookupDomainName(domain string, nameMap map[string]string) string {
	// 1. 配置表精确匹配
	if name, ok := nameMap[domain]; ok {
		return name
	}
	// 2. 配置表去子域名前缀匹配：m.toutiao.com → toutiao.com, finance.sina.com.cn → sina.com.cn
	parts := strings.Split(domain, ".")
	for skip := 1; skip <= 2; skip++ {
		if len(parts)-skip >= 2 {
			candidate := strings.Join(parts[skip:], ".")
			if name, ok := nameMap[candidate]; ok {
				return name
			}
		}
	}
	return ""
}

// extractSiteName 从收录抓取的链接文本中提取站点名，对齐盘古「按分隔符切割取最后一段」的策略。
//
//	例："矿泉水选购技巧 - 知乎" → "知乎"
//	    "景湖山泉...-新澳财经"   → "新澳财经"
//	    "直播-百度直播"          → "百度直播"
//	    "知乎"                   → "知乎"（无分隔符，短文本直接保留）
//	    "景湖山泉、泉阳泉、..."   → ""（无分隔符且过长，判定为文章标题，返回空让调用方回退域名）
func extractSiteName(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}

	// 按中文互联网常见分隔符切割：带空格优先，再无空格
	separators := []string{" – ", " - ", "：", ":", "_", "|", "-"}
	for _, sep := range separators {
		if strings.Contains(raw, sep) {
			parts := strings.Split(raw, sep)
			if len(parts) >= 2 {
				candidate := strings.TrimSpace(parts[len(parts)-1])
				if len([]rune(candidate)) <= 20 {
					return candidate
				}
			}
		}
	}
	// 无分隔符：短文本（≤20字）视为干净站点名；过长则判定为文章标题，返回空
	if len([]rune(raw)) <= 20 {
		return raw
	}
	return ""
}

// --- 竞品分析 ---

// competitorRankRow 是 GetCompetitorRanking 的查询结果行。
type competitorRankRow struct {
	PlatformName string `gorm:"column:platform_name"`
	MentionText  string `gorm:"column:mention_text"`
	EntityType   string `gorm:"column:entity_type"`
	InclusionCnt int64  `gorm:"column:inclusion_cnt"` // 该品牌在该平台被提及的回答数（收录数）
}

// GetCompetitorRanking 获取各 AI 平台前 5 名品牌排序。
// 排序依据：品牌在各个平台的收录数 / 该平台总回答数（收录+未收录），降序取前 5。
func (r *brandBoardRepo) GetCompetitorRanking(ctx context.Context, entID uint64) (*biz.CompetitorRankingPage, error) {
	db := r.data.DB(ctx)

	// 1. 获取每个平台的 valid snapshot 总数（收录+未收录）
	type platformSnapshotCount struct {
		PlatformName string `gorm:"column:platform_name"`
		TotalCount   int64  `gorm:"column:total_count"`
	}
	var platformCounts []platformSnapshotCount
	_ = db.Table(model.TableAnswerSnapshots+" AS s").
		Joins("JOIN "+model.TableInclusionSites+" AS site ON site.id = s.inclusion_site_id").
		Select("site.name AS platform_name, COUNT(*) AS total_count").
		Where("s.enterprise_id = ? AND s.answer_status = ?", entID, "valid").
		Group("site.name").
		Scan(&platformCounts).Error

	platformSnapshotMap := make(map[string]int64, len(platformCounts))
	for _, pc := range platformCounts {
		platformSnapshotMap[pc.PlatformName] = pc.TotalCount
	}

	// 2. 查询每个品牌/竞品在每个平台的收录数（回答级别：一条回答算一次）
	var rows []competitorRankRow
	err := db.Table(model.TableMentions+" AS m").
		Select(`site.name AS platform_name,
			m.text AS mention_text,
			m.entity_type,
			COUNT(DISTINCT m.answer_snapshot_id) AS inclusion_cnt`).
		Joins("JOIN "+model.TableAnswerSnapshots+" AS s ON s.id = m.answer_snapshot_id").
		Joins("JOIN "+model.TableInclusionSites+" AS site ON site.id = s.inclusion_site_id").
		Where("s.enterprise_id = ? AND s.answer_status = ? AND m.entity_type IN ?",
			entID, "valid", []string{"brand", "enterprise", "competitor"}).
		Group("site.name, m.text, m.entity_type").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}

	// 3. 按 platform 分组，计算排序依据（收录数 / 总回答数）
	type rankItem struct {
		Name         string
		EntityType   string
		MentionCount int64
		Rate         float64
	}
	platformItems := make(map[string][]rankItem)
	for _, row := range rows {
		totalSnapshots := platformSnapshotMap[row.PlatformName]
		rate := 0.0
		if totalSnapshots > 0 {
			rate = float64(row.InclusionCnt) / float64(totalSnapshots)
		}
		platformItems[row.PlatformName] = append(platformItems[row.PlatformName], rankItem{
			Name:         row.MentionText,
			EntityType:   row.EntityType,
			MentionCount: row.InclusionCnt,
			Rate:         rate,
		})
	}

	// 4. 按收录率降序排序，取每个平台前 5 名，分配排名
	result := &biz.CompetitorRankingPage{Platforms: make([]*biz.CompetitorPlatformRanking, 0, len(platformItems))}
	for platform, items := range platformItems {
		sort.Slice(items, func(i, j int) bool {
			return items[i].Rate > items[j].Rate
		})

		topN := 5
		if len(items) < topN {
			topN = len(items)
		}
		items = items[:topN]

		brandItems := make([]*biz.CompetitorRankItem, 0, len(items))
		for i, item := range items {
			isOwn := item.EntityType == "brand" || item.EntityType == "enterprise"
			brandItems = append(brandItems, &biz.CompetitorRankItem{
				Name:         item.Name,
				Rank:         int32(i + 1),
				IsOwnBrand:   isOwn,
				MentionCount: item.MentionCount,
			})
		}
		result.Platforms = append(result.Platforms, &biz.CompetitorPlatformRanking{
			Platform: platform,
			Items:    brandItems,
		})
	}
	return result, nil
}

// ListCompetitorBlankKeywords 空白词条分页查询。
// 查询逻辑：找出未收录（brand_mentioned=FALSE）的 valid snapshot，提取排名第一的竞品词。
func (r *brandBoardRepo) ListCompetitorBlankKeywords(ctx context.Context, entID uint64, q biz.CompetitorBlankQuery) (*biz.CompetitorBlankKeywordsPage, error) {
	db := r.data.DB(ctx)
	pageSize := int(q.PageSize)
	if pageSize <= 0 {
		pageSize = 10
	}
	if pageSize > 50 {
		pageSize = 50
	}
	offset := 0
	if q.PageToken != "" {
		if n, err := strconv.Atoi(q.PageToken); err == nil && n > 0 {
			offset = n
		}
	}

	// 1. 查询总数：未收录且有竞品 mention 的 snapshot
	var total int64
	countQuery := db.Table(model.TableAnswerSnapshots+" AS s").
		Joins(dashboardLatestAnalysisJoin).
		Where("s.enterprise_id = ? AND s.answer_status = ? AND analysis.brand_mentioned = FALSE", entID, "valid").
		Where("s.id IN (SELECT DISTINCT answer_snapshot_id FROM geo_mentions WHERE entity_type = 'competitor')")
	countQuery.Count(&total)

	// 2. 查询分页数据：未收录的 snapshot，取 mention_rank 最小的竞品词
	type blankRow struct {
		Question       string `gorm:"column:question_text"`
		SessionRef     string `gorm:"column:session_ref"`
		ObservedAt     string `gorm:"column:observed_at"`
		PlatformName   string `gorm:"column:platform_name"`
		CompetitorText string `gorm:"column:competitor_text"`
		Keyword        string `gorm:"column:keyword"`
	}
	var rows []blankRow
	err := db.Table(model.TableAnswerSnapshots+" AS s").
		Select(`s.question_text, s.session_ref, DATE_FORMAT(s.observed_at, '%Y-%m-%d') AS observed_at,
			site.name AS platform_name,
			(SELECT m.text FROM geo_mentions m WHERE m.answer_snapshot_id = s.id AND m.entity_type = 'competitor' ORDER BY m.mention_rank LIMIT 1) AS competitor_text,
			k.text AS keyword`).
		Joins(dashboardLatestAnalysisJoin).
		Joins("JOIN "+model.TableInclusionSites+" AS site ON site.id = s.inclusion_site_id").
		Joins("JOIN "+model.TableGEOTasks+" AS t ON t.id = s.geo_task_id").
		Joins("JOIN "+model.TableQuestions+" AS q ON q.id = t.question_id").
		Joins("JOIN "+model.TableKeywords+" AS k ON k.id = q.keyword_id").
		Where("s.enterprise_id = ? AND s.answer_status = ? AND analysis.brand_mentioned = FALSE", entID, "valid").
		Where("s.id IN (SELECT DISTINCT answer_snapshot_id FROM geo_mentions WHERE entity_type = 'competitor')").
		Order("s.observed_at DESC").
		Offset(offset).
		Limit(pageSize).
		Find(&rows).Error
	if err != nil {
		return nil, err
	}

	// 3. 构建返回结果
	items := make([]*biz.CompetitorBlankKeyword, 0, len(rows))
	for _, r := range rows {
		items = append(items, &biz.CompetitorBlankKeyword{
			Keyword:        r.Keyword,
			Question:       r.Question,
			CompetitorText: r.CompetitorText,
			Platform:       r.PlatformName,
			ObservedAt:     r.ObservedAt,
			SessionRef:     r.SessionRef,
		})
	}

	nextToken := ""
	if offset+pageSize < int(total) {
		nextToken = strconv.Itoa(offset + pageSize)
	}

	return &biz.CompetitorBlankKeywordsPage{
		Items:         items,
		NextPageToken: nextToken,
		TotalSize:     total,
	}, nil
}

// --- GetCompetitorCompare 竞品核心指标对比 ---

// competitorCompareRow 是 GetCompetitorCompare 的查询结果行。
type competitorCompareRow struct {
	Name        string  `gorm:"column:name"`
	EntityType  string  `gorm:"column:entity_type"`
	AnswerCount int64   `gorm:"column:answer_count"`
	Top3Count   int64   `gorm:"column:top3_count"`
}

// GetCompetitorCompare 获取竞品核心指标对比表。
// 计算逻辑：
//   - AI 回答数：该品牌/竞品在 geo_mentions 中出现的 snapshot 数量
//   - 可见度：(entity_type=brand/enterprise 本品牌使用 dashboard 现有可见度；竞品用 mention_snapshots / total_snapshots)
//   - 采纳率：(当前简化为 top3_count / answer_count 近似)
//   - top3 占比：该品牌/竞品出现在前 3 名的次数 / 出现总次数
func (r *brandBoardRepo) GetCompetitorCompare(ctx context.Context, entID uint64) (*biz.CompetitorComparePage, error) {
	db := r.data.DB(ctx)

	// 1. 获取本品牌的名称与可见率（复用 dashboard）
	var brandName string
	var visibilityRate float64
	if entID > 0 {
		// 优先从 geo_mentions 表取品牌名（entity_type='brand' 的 text）
		_ = db.Table(model.TableMentions).Select("text").Where("enterprise_id = ? AND entity_type = 'brand' LIMIT 1", entID).Scan(&brandName).Error
		if brandName == "" {
			_ = db.Table("ent_enterprises").Select("name").Where("id = ?", entID).Scan(&brandName).Error
		}
		// 复用已有 dashboard 可见率（0-100 百分比）
		var visRatio float64
		_ = db.Raw(`SELECT COALESCE(SUM(CASE WHEN s.id IN (SELECT DISTINCT answer_snapshot_id FROM geo_mentions WHERE entity_type IN ('brand','enterprise')) THEN 1 ELSE 0 END) / NULLIF(COUNT(DISTINCT s.id),0), 0)
			FROM geo_answer_snapshots s WHERE s.enterprise_id = ? AND s.answer_status = 'valid'`, entID).Scan(&visRatio).Error
		// 转为百分比 0-100
		visibilityRate = visRatio * 100
	}

	// 2. 每个品牌/竞品的提及次数（回答级别：一条回答只算 1 次）+ top3 回答数
	var rows []competitorCompareRow
	subQuery := `SELECT m.text AS name, m.entity_type,
		COUNT(DISTINCT m.answer_snapshot_id) AS answer_count,
		COUNT(DISTINCT CASE WHEN m.mention_rank BETWEEN 1 AND 3 THEN m.answer_snapshot_id END) AS top3_count
		FROM geo_mentions m
		JOIN geo_answer_snapshots s ON s.id = m.answer_snapshot_id
		WHERE s.enterprise_id = ? AND s.answer_status = 'valid'
			AND m.entity_type IN ('brand','enterprise','competitor')
		GROUP BY m.text, m.entity_type
		ORDER BY answer_count DESC
		LIMIT 50`
	if err := db.Raw(subQuery, entID).Scan(&rows).Error; err != nil {
		return nil, err
	}

	// 3. 统计总 snapshot 数（用于计算可见度）
	var totalSnapshots int64
	_ = db.Table(model.TableAnswerSnapshots).Where("enterprise_id = ? AND answer_status = ?", entID, "valid").Count(&totalSnapshots).Error

	// 4. 构建 items
	items := make([]*biz.CompetitorCompareItem, 0, len(rows))
	for _, row := range rows {
		isOwn := row.EntityType == "brand" || row.EntityType == "enterprise"
		vis := 0.0
		if isOwn {
			vis = visibilityRate
		} else if totalSnapshots > 0 {
			vis = float64(row.AnswerCount) / float64(totalSnapshots) * 100
		}
		top3Rate := 0.0
		if row.AnswerCount > 0 {
			top3Rate = float64(row.Top3Count) / float64(row.AnswerCount) * 100
		}
		adoptionRate := top3Rate // 简化：用 top3 占比近似采纳率（百分比 0-100）
		if isOwn {
			// 本品牌：采纳率占位为 top3Rate
			adoptionRate = top3Rate
		}
		displayName := row.Name
		if isOwn && brandName != "" {
			displayName = brandName
		}
		items = append(items, &biz.CompetitorCompareItem{
			Name:           displayName,
			IsOwnBrand:     isOwn,
			VisibilityRate: vis,
			AdoptionRate:   adoptionRate,
			AnswerCount:    row.AnswerCount,
			Top3Rate:       top3Rate,
		})
	}

	// 5. 若查询无数据，仍返回本品牌占位（保证前端可展示）
	if len(items) == 0 && brandName != "" {
		items = append(items, &biz.CompetitorCompareItem{
			Name:           brandName,
			IsOwnBrand:     true,
			VisibilityRate: visibilityRate,
			AdoptionRate:   visibilityRate,
			AnswerCount:    0,
			Top3Rate:       0,
		})
	}

	// 6. 查询近7天按日趋势（回答级别，每个品牌/竞品每天被提及的 snapshot 数）
	now := time.Now().UTC()
	from := now.AddDate(0, 0, -7)
	trendRows := []struct {
		Name  string `gorm:"column:name"`
		Bucket string `gorm:"column:bucket"`
		Cnt   int64  `gorm:"column:cnt"`
	}{}
	_ = db.Table(model.TableMentions+" AS m").
		Joins("JOIN "+model.TableAnswerSnapshots+" AS s ON s.id = m.answer_snapshot_id").
		Select(`CASE WHEN m.entity_type IN ('brand','enterprise') THEN ? ELSE m.text END AS name,
			DATE_FORMAT(DATE_ADD(s.observed_at, INTERVAL 8 HOUR), '%Y-%m-%d') AS bucket,
			COUNT(DISTINCT m.answer_snapshot_id) AS cnt`, brandName).
		Where("s.enterprise_id = ? AND s.answer_status = 'valid' AND s.observed_at >= ? AND m.entity_type IN ('brand','enterprise','competitor')", entID, from).
		Group("name, bucket").
		Scan(&trendRows).Error

	// 构建日期序列
	trendDates := make([]string, 0, 7)
	for i := 6; i >= 0; i-- {
		d := now.AddDate(0, 0, -i).In(dashboardLoc)
		trendDates = append(trendDates, d.Format("2006-01-02"))
	}

	// 构建趋势数据 map[品牌名] -> map[日期] -> count
	type brandDayCount = map[string]map[string]int64
	trendMap := brandDayCount{}
	for _, r := range trendRows {
		if trendMap[r.Name] == nil {
			trendMap[r.Name] = map[string]int64{}
		}
		trendMap[r.Name][r.Bucket] = r.Cnt
	}

	// 构建趋势数据 map[品牌名] -> []int64 (按日期序列)
	trendData := make(map[string][]int64)
	// 只为 top5 品牌构建趋势
	for _, item := range items {
		name := item.Name
		series := make([]int64, len(trendDates))
		if dayMap, ok := trendMap[name]; ok {
			for i, d := range trendDates {
				series[i] = dayMap[d]
			}
		}
		trendData[name] = series
	}

	return &biz.CompetitorComparePage{Items: items, TrendDates: trendDates, TrendData: trendData}, nil
}
