package biz

import (
	"context"
	"time"
)

// BrandCompanyInfo 企业信息（顶栏 4 统计卡 + 名片）。
type BrandCompanyInfo struct {
	EnterpriseName string
	BrandName      string
	Website        string
	KeywordCount   int64
	TermCount      int64
	TotalInclusion int64
	ArticleCount   int64
	StartedAt      *time.Time
	ExpiresAt      *time.Time
	BrandKeywords  []string
}

// BrandRecommendation 单平台推荐度（当日范围）。
// Recommendation = 品牌可见度（= 收录 snapshot / 全部 snapshot × 100，与圆环口径一致）。
// VisibilityRate = 当日可见度（与 Recommendation 相同，保留字段以兼容前端）。
// MentionCount = 当日提及任务数（= 收录 snapshot 数 = SUM(brand_mentioned)）。
// Sentiment = 该平台当日提及的主导情感（positive/neutral/negative）。
type BrandRecommendation struct {
	Platform       string
	Recommendation int32
	InclusionCount int64
	VisibilityRate float64
	MentionCount   int64
	Sentiment      string
}

// BrandIndexTop 品牌推荐度（7 平台进度条）。
type BrandIndexTop struct {
	Platforms []*BrandRecommendation
}

// BrandPlatformStat 单平台数据大盘分项。
type BrandPlatformStat struct {
	Platform       string
	VisibilityRate float64
	MentionCount   int64
	Sentiment      string
	InclusionCount int64
}

// BrandDashboard 数据大盘（5 聚合指标 + 各平台分项）。
type BrandDashboard struct {
	VisibilityRate float64
	Top3Rate       float64
	PositiveRate   float64
	MentionCount   int64
	DialogueRounds int64
	Platforms      []*BrandPlatformStat
}

// BrandTrendPoint 趋势数据点。date 格式 YYYY-MM-DD（year 用 YYYY-MM）。
type BrandTrendPoint struct {
	Date  string
	Value int64
	Rate  float64
}

// BrandSentimentStat 情感倾向统计。Sentiment: positive/neutral/negative（前端显示 无/正/负）。
type BrandSentimentStat struct {
	Sentiment string
	Count     int64
	Rate      float64
}

// BrandIndexMain 主区数据（3 趋势折线 + 情感倾向表）。
type BrandIndexMain struct {
	InclusionTrend  []*BrandTrendPoint
	VisibilityTrend []*BrandTrendPoint
	MentionTrend    []*BrandTrendPoint
	Sentiment       []*BrandSentimentStat
}

// BrandOpinion 单条舆情总结（LLM 生成的分类总结建议）。
type BrandOpinion struct {
	Title      string
	Summary    string
	Sentiment  string
	OccurredAt *time.Time
}

// NegativeEvent 负面事件明细（单条 negative AI 回答）。
type NegativeEvent struct {
	Platform      string
	Question      string
	AnswerPreview string
	Sentiment     string
	ShareURL      string
	ObservedAt    *time.Time
}

// BrandIndexBottom 舆情分析。
type BrandIndexBottom struct {
	PeriodType    string
	Opinions      []*BrandOpinion
	NegativeEvents []*NegativeEvent
}

// OpinionBrandTarget 舆情调度目标（有回答数据的 企业×品牌 组合）。
type OpinionBrandTarget struct {
	EnterpriseID uint64
	BrandID      uint64
}

// BrandQuestionStat 收录详情按问题词条聚合。
type BrandQuestionStat struct {
	Question    string
	TotalCount  int64
	PeriodCount int64
}

// BrandSummary 周月报摘要。
type BrandSummary struct {
	PeriodType      string
	PeriodStart     string
	PeriodEnd       string
	VisibilityRate  float64
	VisibilityDelta  float64
	Top3Rate        float64
	Top3RateDelta   float64  // -1 表示上期无数据
	MentionCount    int64
	MentionDelta    int64
	TotalInclusion  int64
	InclusionDelta  int64
	Questions       []*BrandQuestionStat
}

// BrandBoardOptions 品牌看板查询选项。
type BrandBoardOptions struct {
	Range      string // 7d / month / year
	PeriodType string // week / month（可选，指定时覆盖 Range）
	PeriodDate string // YYYY-MM-DD（可选，配合 PeriodType）
}

// GeoBrandBoardRepo 品牌看板仓储接口（由 data 层实现）。
type GeoBrandBoardRepo interface {
	GetCompanyInfo(context.Context, uint64) (*BrandCompanyInfo, error)
	GetIndexTop(context.Context, uint64, BrandBoardOptions) (*BrandIndexTop, error)
	GetDashboard(context.Context, uint64) (*BrandDashboard, error)
	GetIndexMain(context.Context, uint64, BrandBoardOptions) (*BrandIndexMain, error)
	GetIndexBottom(context.Context, uint64, string) (*BrandIndexBottom, error)
	GetSummary(context.Context, uint64, string, time.Time) (*BrandSummary, error)
	ListBrandRecords(context.Context, uint64, BrandRecordQuery) (*BrandRecordsPage, error)
	GetBrandOptimizeStats(context.Context, uint64) (*BrandOptimizeStats, error)
	GetSourceAnalysis(context.Context, uint64, string) (*BrandSourceAnalysis, error)
	GetCompetitorRanking(context.Context, uint64) (*CompetitorRankingPage, error)
	ListCompetitorBlankKeywords(context.Context, uint64, CompetitorBlankQuery) (*CompetitorBlankKeywordsPage, error)
	GetCompetitorCompare(context.Context, uint64) (*CompetitorComparePage, error)
	// 舆情总结（周期 LLM 报告）。
	ListBrandsWithAnswers(context.Context) ([]OpinionBrandTarget, error)
	GenerateOpinionSummary(context.Context, uint64, uint64, string, time.Time) error
}

// GeoBrandBoardUsecase 品牌看板用例。
type GeoBrandBoardUsecase struct {
	repo GeoBrandBoardRepo
}

// NewGeoBrandBoardUsecase 构造品牌看板用例。
func NewGeoBrandBoardUsecase(r GeoBrandBoardRepo) *GeoBrandBoardUsecase {
	return &GeoBrandBoardUsecase{repo: r}
}

// CompanyInfo 获取企业信息与顶栏 4 统计卡。
func (uc *GeoBrandBoardUsecase) CompanyInfo(ctx context.Context, entID uint64) (*BrandCompanyInfo, error) {
	return uc.repo.GetCompanyInfo(ctx, entID)
}

// IndexTop 获取品牌推荐度。opts.PeriodType 非空时按周/月范围查询，否则按当日。
func (uc *GeoBrandBoardUsecase) IndexTop(ctx context.Context, entID uint64, opts BrandBoardOptions) (*BrandIndexTop, error) {
	return uc.repo.GetIndexTop(ctx, entID, opts)
}

// Dashboard 获取数据大盘。
func (uc *GeoBrandBoardUsecase) Dashboard(ctx context.Context, entID uint64) (*BrandDashboard, error) {
	return uc.repo.GetDashboard(ctx, entID)
}

// IndexMain 获取主区数据（3 趋势 + 情感）。
func (uc *GeoBrandBoardUsecase) IndexMain(ctx context.Context, entID uint64, opts BrandBoardOptions) (*BrandIndexMain, error) {
	return uc.repo.GetIndexMain(ctx, entID, opts)
}

// IndexBottom 获取舆情分析。
func (uc *GeoBrandBoardUsecase) IndexBottom(ctx context.Context, entID uint64, period string) (*BrandIndexBottom, error) {
	return uc.repo.GetIndexBottom(ctx, entID, period)
}

// Summary 获取周月报摘要。
func (uc *GeoBrandBoardUsecase) Summary(ctx context.Context, entID uint64, period string, refDate time.Time) (*BrandSummary, error) {
	return uc.repo.GetSummary(ctx, entID, period, refDate)
}

// --- 优化记录 ---

// BrandRecord 优化记录单条。
type BrandRecord struct {
	ID            uint64
	Keyword       string
	Question      string
	Platform      string
	PlatformIcon  string
	Included      bool
	MentionCount  int64
	BrandRank     int32
	Sentiment     string
	TerminalType  int32
	ObservedAt    time.Time
	SessionRef    string
	TaskStatus    string
	ContactExposed bool
}

// BrandRecordsPage 优化记录分页。
type BrandRecordsPage struct {
	Records      []*BrandRecord
	NextPageToken string
	TotalSize    int64
}

// BrandOptimizeStats 优化统计卡。
type BrandOptimizeStats struct {
	TotalOptimizeDays    int64
	TotalQualifiedDays   int64
	RemainingDays        int64
	TodayInclusion       int64
	TodayPCInclusion     int64
	TodayMobileInclusion int64
}

// BrandRecordQuery 优化记录查询参数。
type BrandRecordQuery struct {
	PageSize       int32
	PageToken      string
	InclusionSiteID int64
	Keyword        string
	StatusFilter   string
	SentimentFilter string
}

// ListBrandRecords 优化记录分页查询。
func (uc *GeoBrandBoardUsecase) ListBrandRecords(ctx context.Context, entID uint64, q BrandRecordQuery) (*BrandRecordsPage, error) {
	return uc.repo.ListBrandRecords(ctx, entID, q)
}

// OptimizeStats 优化统计卡。
func (uc *GeoBrandBoardUsecase) OptimizeStats(ctx context.Context, entID uint64) (*BrandOptimizeStats, error) {
	return uc.repo.GetBrandOptimizeStats(ctx, entID)
}

// --- 信源分析 ---

// BrandSourceAnalysis 信源分析聚合数据。
type BrandSourceAnalysis struct {
	ArticlePublishCount  int64
	ArticleCitationCount int64
	SourceReferenceCount int64
	MediaBreakdown       *MediaArticleBreakdown
	TopArticles          []*SourceArticleStat
	PublishTrend         []*ArticlePublishTrendPoint
	TopSourcePlatforms   []*SourcePlatformStat
}

// MediaArticleBreakdown 媒体文章分布。
type MediaArticleBreakdown struct {
	Total               int64
	SelfMediaCount      int64
	CommercialMediaCount int64
	OfficialKBCount     int64
}

// SourceArticleStat Top10 文章引用统计。
type SourceArticleStat struct {
	Rank          int32
	Title         string
	CitationCount int64
	ArticleID     uint64
	URL           string // 文章发布后的外部 URL（跳转链接）
}

// ArticlePublishTrendPoint 文章发布趋势数据点。
type ArticlePublishTrendPoint struct {
	Date  string
	Count int64
}

// SourcePlatformStat Top10 信源平台分布。
type SourcePlatformStat struct {
	Rank          int32
	Domain        string
	Title         string
	CitationCount int64
}

// SourceAnalysis 获取信源分析数据。
func (uc *GeoBrandBoardUsecase) SourceAnalysis(ctx context.Context, entID uint64, rng string) (*BrandSourceAnalysis, error) {
	if rng == "" {
		rng = "7d"
	}
	return uc.repo.GetSourceAnalysis(ctx, entID, rng)
}

// --- 竞品分析 ---

// CompetitorRankingPage 竞品品牌排序分页。
type CompetitorRankingPage struct {
	Platforms []*CompetitorPlatformRanking
}

// CompetitorPlatformRanking 单个 AI 平台的品牌排序。
type CompetitorPlatformRanking struct {
	Platform string
	Items    []*CompetitorRankItem
}

// CompetitorRankItem 单个品牌排序项。
type CompetitorRankItem struct {
	Name         string
	Rank         int32
	IsOwnBrand   bool
	MentionCount int64 // 提及数（按条数，一条回答出现N次算1次）
}

// CompetitorBlankKeywordsPage 空白词条分页。
type CompetitorBlankKeywordsPage struct {
	Items         []*CompetitorBlankKeyword
	NextPageToken string
	TotalSize     int64
}

// CompetitorBlankKeyword 单条空白词条。
type CompetitorBlankKeyword struct {
	Keyword       string
	Question      string
	CompetitorText string
	Platform      string
	ObservedAt    string
	SessionRef    string
}

// CompetitorBlankQuery 空白词条查询参数。
type CompetitorBlankQuery struct {
	PageSize  int32
	PageToken string
}

// CompetitorRanking 获取竞品品牌排序（各平台前 5 名）。
func (uc *GeoBrandBoardUsecase) CompetitorRanking(ctx context.Context, entID uint64) (*CompetitorRankingPage, error) {
	return uc.repo.GetCompetitorRanking(ctx, entID)
}

// ListCompetitorBlankKeywords 空白词条分页查询。
func (uc *GeoBrandBoardUsecase) ListCompetitorBlankKeywords(ctx context.Context, entID uint64, q CompetitorBlankQuery) (*CompetitorBlankKeywordsPage, error) {
	if q.PageSize == 0 {
		q.PageSize = 10
	}
	return uc.repo.ListCompetitorBlankKeywords(ctx, entID, q)
}

// CompetitorComparePage 竞品核心指标对比分页。
type CompetitorComparePage struct {
	Items       []*CompetitorCompareItem
	TrendDates  []string                  // 趋势日期序列
	TrendData   map[string][]int64        // 每个品牌的按日提及次数（key=品牌名）
}

// CompetitorCompareItem 单个品牌/竞品核心指标。
type CompetitorCompareItem struct {
	Name           string
	IsOwnBrand     bool
	VisibilityRate float64
	AdoptionRate   float64
	AnswerCount    int64
	Top3Rate       float64
}

// CompetitorCompare 获取竞品核心指标对比。
func (uc *GeoBrandBoardUsecase) CompetitorCompare(ctx context.Context, entID uint64) (*CompetitorComparePage, error) {
	return uc.repo.GetCompetitorCompare(ctx, entID)
}
