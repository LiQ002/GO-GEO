package service

import (
	"context"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"

	v1 "kratos-svr/api/user/v1"
	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/authn"
)

// brandBoardParseDate 解析 "2006-01-02" 格式的日期字符串，空或非法时返回零值。
func brandBoardParseDate(s string) time.Time {
	if s == "" {
		return time.Time{}
	}
	t, err := time.ParseInLocation("2006-01-02", s, time.Local)
	if err != nil {
		return time.Time{}
	}
	return t
}

// GeoBrandBoardService 品牌看板服务（高级报表）。
// 仅做 DTO↔DO 转换，业务规则见 biz.GeoBrandBoardUsecase。
type GeoBrandBoardService struct {
	v1.UnimplementedGeoBrandBoardServiceServer
	uc *biz.GeoBrandBoardUsecase
}

// NewGeoBrandBoardService 构造品牌看板服务。
func NewGeoBrandBoardService(uc *biz.GeoBrandBoardUsecase) *GeoBrandBoardService {
	return &GeoBrandBoardService{uc: uc}
}

// GetBrandCompanyInfo 获取企业信息与顶栏 4 统计卡。
func (s *GeoBrandBoardService) GetBrandCompanyInfo(ctx context.Context, req *v1.GetBrandBoardRequest) (*v1.BrandCompanyInfo, error) {
	e, x := authn.RequireEnterprise(ctx)
	if x != nil {
		return nil, x
	}
	o, err := s.uc.CompanyInfo(ctx, e)
	if err != nil {
		return nil, err
	}
	return brandCompanyInfoDTO(o), nil
}

// GetBrandIndexTop 获取品牌推荐度（7 平台进度条）。
// req.PeriodType + req.PeriodDate：指定时按周/月范围查询（用于周报/月报平台明细）。
func (s *GeoBrandBoardService) GetBrandIndexTop(ctx context.Context, req *v1.GetBrandBoardRequest) (*v1.BrandIndexTop, error) {
	e, x := authn.RequireEnterprise(ctx)
	if x != nil {
		return nil, x
	}
	o, err := s.uc.IndexTop(ctx, e, biz.BrandBoardOptions{
		Range:      req.GetRange(),
		PeriodType: req.GetPeriodType(),
		PeriodDate: req.GetPeriodDate(),
	})
	if err != nil {
		return nil, err
	}
	return brandIndexTopDTO(o), nil
}

// GetBrandDashboard 获取数据大盘（5 聚合指标 + 各平台分项）。
func (s *GeoBrandBoardService) GetBrandDashboard(ctx context.Context, req *v1.GetBrandBoardRequest) (*v1.BrandDashboard, error) {
	e, x := authn.RequireEnterprise(ctx)
	if x != nil {
		return nil, x
	}
	o, err := s.uc.Dashboard(ctx, e)
	if err != nil {
		return nil, err
	}
	return brandDashboardDTO(o), nil
}

// GetBrandIndexMain 获取主区数据（3 趋势折线 + 情感倾向表）。
// req.Range 控制趋势分桶：7d（默认）/ month / year；空串由 data 层兜底为 7d。
// req.PeriodType + req.PeriodDate：指定时按周/月范围替代 Range（用于周报/月报趋势图）。
func (s *GeoBrandBoardService) GetBrandIndexMain(ctx context.Context, req *v1.GetBrandBoardRequest) (*v1.BrandIndexMain, error) {
	e, x := authn.RequireEnterprise(ctx)
	if x != nil {
		return nil, x
	}
	o, err := s.uc.IndexMain(ctx, e, biz.BrandBoardOptions{
		Range:      req.GetRange(),
		PeriodType: req.GetPeriodType(),
		PeriodDate: req.GetPeriodDate(),
	})
	if err != nil {
		return nil, err
	}
	return brandIndexMainDTO(o), nil
}

// GetBrandIndexBottom 获取舆情分析（周结/月结）。
// 本接口 req 无独立 period 字段，暂以 req.Range 作为 period 传入 usecase；
// data 层 brandBoardPeriodRange 对非 "month" 一律按 week 处理，故 7d/空串→week、month→month。
func (s *GeoBrandBoardService) GetBrandIndexBottom(ctx context.Context, req *v1.GetBrandBoardRequest) (*v1.BrandIndexBottom, error) {
	e, x := authn.RequireEnterprise(ctx)
	if x != nil {
		return nil, x
	}
	o, err := s.uc.IndexBottom(ctx, e, req.GetRange())
	if err != nil {
		return nil, err
	}
	return brandIndexBottomDTO(o), nil
}

// GetBrandSummary 获取周月报摘要（环比 + 收录详情按问题词条）。
// period_type: week / month，由 req.PeriodType 传入。
// period_date: 可选 "2006-01-02"，指定周/月的基准日期。
func (s *GeoBrandBoardService) GetBrandSummary(ctx context.Context, req *v1.GetBrandSummaryRequest) (*v1.BrandSummary, error) {
	e, x := authn.RequireEnterprise(ctx)
	if x != nil {
		return nil, x
	}
	refDate := brandBoardParseDate(req.GetPeriodDate())
	o, err := s.uc.Summary(ctx, e, req.GetPeriodType(), refDate)
	if err != nil {
		return nil, err
	}
	return brandSummaryDTO(o), nil
}

// ListBrandRecords 获取优化记录明细（分页）。
func (s *GeoBrandBoardService) ListBrandRecords(ctx context.Context, req *v1.ListBrandRecordsRequest) (*v1.BrandRecordsPage, error) {
	e, x := authn.RequireEnterprise(ctx)
	if x != nil {
		return nil, x
	}
	q := biz.BrandRecordQuery{
		PageSize:        req.GetPageSize(),
		PageToken:       req.GetPageToken(),
		InclusionSiteID: req.GetInclusionSiteId(),
		Keyword:         req.GetKeyword(),
		StatusFilter:    req.GetStatusFilter(),
		SentimentFilter: req.GetSentimentFilter(),
	}
	o, err := s.uc.ListBrandRecords(ctx, e, q)
	if err != nil {
		return nil, err
	}
	return brandRecordsPageDTO(o), nil
}

// GetBrandOptimizeStats 获取优化统计卡。
func (s *GeoBrandBoardService) GetBrandOptimizeStats(ctx context.Context, req *v1.GetBrandBoardRequest) (*v1.BrandOptimizeStats, error) {
	e, x := authn.RequireEnterprise(ctx)
	if x != nil {
		return nil, x
	}
	o, err := s.uc.OptimizeStats(ctx, e)
	if err != nil {
		return nil, err
	}
	return brandOptimizeStatsDTO(o), nil
}

// --- DTO 转换 helper ---

func brandCompanyInfoDTO(i *biz.BrandCompanyInfo) *v1.BrandCompanyInfo {
	if i == nil {
		return nil
	}
	o := &v1.BrandCompanyInfo{
		EnterpriseName: i.EnterpriseName,
		BrandName:      i.BrandName,
		Website:        i.Website,
		KeywordCount:   i.KeywordCount,
		TermCount:      i.TermCount,
		TotalInclusion: i.TotalInclusion,
		ArticleCount:   i.ArticleCount,
		BrandKeywords:  i.BrandKeywords,
	}
	if i.StartedAt != nil {
		o.StartedAt = timestamppb.New(*i.StartedAt)
	}
	if i.ExpiresAt != nil {
		o.ExpiresAt = timestamppb.New(*i.ExpiresAt)
	}
	return o
}

func brandRecommendationDTO(i *biz.BrandRecommendation) *v1.BrandRecommendation {
	if i == nil {
		return nil
	}
	return &v1.BrandRecommendation{
		Platform:       i.Platform,
		Recommendation: i.Recommendation,
		InclusionCount: i.InclusionCount,
		VisibilityRate: i.VisibilityRate,
		MentionCount:   i.MentionCount,
		Sentiment:      i.Sentiment,
	}
}

func brandIndexTopDTO(i *biz.BrandIndexTop) *v1.BrandIndexTop {
	if i == nil {
		return nil
	}
	o := &v1.BrandIndexTop{Platforms: make([]*v1.BrandRecommendation, 0, len(i.Platforms))}
	for _, p := range i.Platforms {
		o.Platforms = append(o.Platforms, brandRecommendationDTO(p))
	}
	return o
}

func brandPlatformStatDTO(i *biz.BrandPlatformStat) *v1.BrandPlatformStat {
	if i == nil {
		return nil
	}
	return &v1.BrandPlatformStat{
		Platform:       i.Platform,
		VisibilityRate: i.VisibilityRate,
		MentionCount:   i.MentionCount,
		Sentiment:      i.Sentiment,
		InclusionCount: i.InclusionCount,
	}
}

func brandDashboardDTO(i *biz.BrandDashboard) *v1.BrandDashboard {
	if i == nil {
		return nil
	}
	o := &v1.BrandDashboard{
		VisibilityRate: i.VisibilityRate,
		Top3Rate:       i.Top3Rate,
		PositiveRate:   i.PositiveRate,
		MentionCount:   i.MentionCount,
		DialogueRounds: i.DialogueRounds,
		Platforms:      make([]*v1.BrandPlatformStat, 0, len(i.Platforms)),
	}
	for _, p := range i.Platforms {
		o.Platforms = append(o.Platforms, brandPlatformStatDTO(p))
	}
	return o
}

func brandTrendPointDTO(i *biz.BrandTrendPoint) *v1.BrandTrendPoint {
	if i == nil {
		return nil
	}
	return &v1.BrandTrendPoint{Date: i.Date, Value: i.Value, Rate: i.Rate}
}

func brandSentimentStatDTO(i *biz.BrandSentimentStat) *v1.BrandSentimentStat {
	if i == nil {
		return nil
	}
	return &v1.BrandSentimentStat{Sentiment: i.Sentiment, Count: i.Count, Rate: i.Rate}
}

func brandIndexMainDTO(i *biz.BrandIndexMain) *v1.BrandIndexMain {
	if i == nil {
		return nil
	}
	o := &v1.BrandIndexMain{
		InclusionTrend:     make([]*v1.BrandTrendPoint, 0, len(i.InclusionTrend)),
		VisibilityTrend:    make([]*v1.BrandTrendPoint, 0, len(i.VisibilityTrend)),
		MentionTrend:       make([]*v1.BrandTrendPoint, 0, len(i.MentionTrend)),
		SentimentBreakdown: make([]*v1.BrandSentimentStat, 0, len(i.Sentiment)),
	}
	for _, p := range i.InclusionTrend {
		o.InclusionTrend = append(o.InclusionTrend, brandTrendPointDTO(p))
	}
	for _, p := range i.VisibilityTrend {
		o.VisibilityTrend = append(o.VisibilityTrend, brandTrendPointDTO(p))
	}
	for _, p := range i.MentionTrend {
		o.MentionTrend = append(o.MentionTrend, brandTrendPointDTO(p))
	}
	for _, p := range i.Sentiment {
		o.SentimentBreakdown = append(o.SentimentBreakdown, brandSentimentStatDTO(p))
	}
	return o
}

func brandOpinionDTO(i *biz.BrandOpinion) *v1.BrandOpinion {
	if i == nil {
		return nil
	}
	o := &v1.BrandOpinion{Title: i.Title, Summary: i.Summary, Sentiment: i.Sentiment}
	if i.OccurredAt != nil {
		o.OccurredAt = timestamppb.New(*i.OccurredAt)
	}
	return o
}

func negativeEventDTO(i *biz.NegativeEvent) *v1.NegativeEvent {
	if i == nil {
		return nil
	}
	o := &v1.NegativeEvent{
		Platform:      i.Platform,
		Question:      i.Question,
		AnswerPreview: i.AnswerPreview,
		Sentiment:     i.Sentiment,
		ShareUrl:      i.ShareURL,
	}
	if i.ObservedAt != nil {
		o.ObservedAt = timestamppb.New(*i.ObservedAt)
	}
	return o
}

func brandIndexBottomDTO(i *biz.BrandIndexBottom) *v1.BrandIndexBottom {
	if i == nil {
		return nil
	}
	o := &v1.BrandIndexBottom{
		PeriodType:      i.PeriodType,
		Opinions:        make([]*v1.BrandOpinion, 0, len(i.Opinions)),
		NegativeEvents:  make([]*v1.NegativeEvent, 0, len(i.NegativeEvents)),
	}
	for _, p := range i.Opinions {
		o.Opinions = append(o.Opinions, brandOpinionDTO(p))
	}
	for _, e := range i.NegativeEvents {
		o.NegativeEvents = append(o.NegativeEvents, negativeEventDTO(e))
	}
	return o
}

func brandQuestionStatDTO(i *biz.BrandQuestionStat) *v1.BrandQuestionStat {
	if i == nil {
		return nil
	}
	return &v1.BrandQuestionStat{Question: i.Question, TotalCount: i.TotalCount, PeriodCount: i.PeriodCount}
}

func brandSummaryDTO(i *biz.BrandSummary) *v1.BrandSummary {
	if i == nil {
		return nil
	}
	o := &v1.BrandSummary{
		PeriodType:      i.PeriodType,
		PeriodStart:     i.PeriodStart,
		PeriodEnd:       i.PeriodEnd,
		VisibilityRate:  i.VisibilityRate,
		VisibilityDelta: i.VisibilityDelta,
		Top3Rate:        i.Top3Rate,
		Top3RateDelta:   i.Top3RateDelta,
		MentionCount:    i.MentionCount,
		MentionDelta:    i.MentionDelta,
		TotalInclusion:  i.TotalInclusion,
		InclusionDelta:  i.InclusionDelta,
		Questions:       make([]*v1.BrandQuestionStat, 0, len(i.Questions)),
	}
	for _, q := range i.Questions {
		o.Questions = append(o.Questions, brandQuestionStatDTO(q))
	}
	return o
}

// --- 优化记录 DTO ---

func brandRecordDTO(i *biz.BrandRecord) *v1.BrandRecord {
	if i == nil {
		return nil
	}
	return &v1.BrandRecord{
		Id:           i.ID,
		Keyword:      i.Keyword,
		Question:     i.Question,
		Platform:     i.Platform,
		PlatformIcon: i.PlatformIcon,
		Included:     i.Included,
		MentionCount: i.MentionCount,
		BrandRank:    i.BrandRank,
		Sentiment:    i.Sentiment,
		TerminalType: i.TerminalType,
		ObservedAt:   timestamppb.New(i.ObservedAt),
		SessionRef:   i.SessionRef,
		TaskStatus:   i.TaskStatus,
		ContactExposed: i.ContactExposed,
	}
}

func brandRecordsPageDTO(i *biz.BrandRecordsPage) *v1.BrandRecordsPage {
	if i == nil {
		return nil
	}
	o := &v1.BrandRecordsPage{
		Records:      make([]*v1.BrandRecord, 0, len(i.Records)),
		NextPageToken: i.NextPageToken,
		TotalSize:    i.TotalSize,
	}
	for _, r := range i.Records {
		o.Records = append(o.Records, brandRecordDTO(r))
	}
	return o
}

func brandOptimizeStatsDTO(i *biz.BrandOptimizeStats) *v1.BrandOptimizeStats {
	if i == nil {
		return nil
	}
	return &v1.BrandOptimizeStats{
		TotalOptimizeDays:    i.TotalOptimizeDays,
		TotalQualifiedDays:   i.TotalQualifiedDays,
		RemainingDays:        i.RemainingDays,
		TodayInclusion:       i.TodayInclusion,
		TodayPcInclusion:     i.TodayPCInclusion,
		TodayMobileInclusion: i.TodayMobileInclusion,
	}
}

// GetBrandSourceAnalysis 获取信源分析。
func (s *GeoBrandBoardService) GetBrandSourceAnalysis(ctx context.Context, req *v1.GetBrandSourceAnalysisRequest) (*v1.BrandSourceAnalysis, error) {
	e, x := authn.RequireEnterprise(ctx)
	if x != nil {
		return nil, x
	}
	o, err := s.uc.SourceAnalysis(ctx, e, req.GetRange())
	if err != nil {
		return nil, err
	}
	return brandSourceAnalysisDTO(o), nil
}

// GetCompetitorRanking 获取竞品品牌排序（各平台前 5 名）。
func (s *GeoBrandBoardService) GetCompetitorRanking(ctx context.Context, req *v1.GetBrandBoardRequest) (*v1.CompetitorRankingPage, error) {
	e, x := authn.RequireEnterprise(ctx)
	if x != nil {
		return nil, x
	}
	o, err := s.uc.CompetitorRanking(ctx, e)
	if err != nil {
		return nil, err
	}
	return competitorRankingDTO(o), nil
}

// ListCompetitorBlankKeywords 空白词条列表。
func (s *GeoBrandBoardService) ListCompetitorBlankKeywords(ctx context.Context, req *v1.ListCompetitorBlankKeywordsRequest) (*v1.CompetitorBlankKeywordsPage, error) {
	e, x := authn.RequireEnterprise(ctx)
	if x != nil {
		return nil, x
	}
	o, err := s.uc.ListCompetitorBlankKeywords(ctx, e, biz.CompetitorBlankQuery{
		PageSize:  req.GetPageSize(),
		PageToken: req.GetPageToken(),
	})
	if err != nil {
		return nil, err
	}
	return competitorBlankKeywordsDTO(o), nil
}

// --- 竞品分析 DTO ---

func competitorRankingDTO(o *biz.CompetitorRankingPage) *v1.CompetitorRankingPage {
	if o == nil {
		return nil
	}
	platforms := make([]*v1.CompetitorPlatformRanking, 0, len(o.Platforms))
	for _, p := range o.Platforms {
		items := make([]*v1.CompetitorRankItem, 0, len(p.Items))
		for _, i := range p.Items {
			items = append(items, &v1.CompetitorRankItem{
				Name:         i.Name,
				Rank:         i.Rank,
				IsOwnBrand:   i.IsOwnBrand,
				MentionCount: i.MentionCount,
			})
		}
		platforms = append(platforms, &v1.CompetitorPlatformRanking{
			Platform: p.Platform,
			Items:    items,
		})
	}
	return &v1.CompetitorRankingPage{Platforms: platforms}
}

func competitorBlankKeywordsDTO(o *biz.CompetitorBlankKeywordsPage) *v1.CompetitorBlankKeywordsPage {
	if o == nil {
		return nil
	}
	items := make([]*v1.CompetitorBlankKeyword, 0, len(o.Items))
	for _, i := range o.Items {
		items = append(items, &v1.CompetitorBlankKeyword{
			Keyword:        i.Keyword,
			Question:       i.Question,
			CompetitorText: i.CompetitorText,
			Platform:       i.Platform,
			ObservedAt:      i.ObservedAt,
			SessionRef:     i.SessionRef,
		})
	}
	return &v1.CompetitorBlankKeywordsPage{
		Items:         items,
		NextPageToken: o.NextPageToken,
		TotalSize:     o.TotalSize,
	}
}

// GetCompetitorCompare 获取竞品核心指标对比。
func (s *GeoBrandBoardService) GetCompetitorCompare(ctx context.Context, req *v1.GetBrandBoardRequest) (*v1.CompetitorComparePage, error) {
	e, x := authn.RequireEnterprise(ctx)
	if x != nil {
		return nil, x
	}
	o, err := s.uc.CompetitorCompare(ctx, e)
	if err != nil {
		return nil, err
	}
	return competitorCompareDTO(o), nil
}

func competitorCompareDTO(o *biz.CompetitorComparePage) *v1.CompetitorComparePage {
	if o == nil {
		return nil
	}
	items := make([]*v1.CompetitorCompareItem, 0, len(o.Items))
	for _, i := range o.Items {
		items = append(items, &v1.CompetitorCompareItem{
			Name:           i.Name,
			IsOwnBrand:     i.IsOwnBrand,
			VisibilityRate: i.VisibilityRate,
			AdoptionRate:   i.AdoptionRate,
			AnswerCount:    i.AnswerCount,
			Top3Rate:       i.Top3Rate,
		})
	}
	// 趋势数据转换
	trendData := make(map[string]*v1.CompetitorTrendValues, len(o.TrendData))
	for name, values := range o.TrendData {
		trendData[name] = &v1.CompetitorTrendValues{Values: values}
	}
	return &v1.CompetitorComparePage{Items: items, TrendDates: o.TrendDates, TrendData: trendData}
}

func mediaArticleBreakdownDTO(i *biz.MediaArticleBreakdown) *v1.MediaArticleBreakdown {
	if i == nil {
		return nil
	}
	return &v1.MediaArticleBreakdown{
		Total:               i.Total,
		SelfMediaCount:      i.SelfMediaCount,
		CommercialMediaCount: i.CommercialMediaCount,
		OfficialKbCount:     i.OfficialKBCount,
	}
}

func sourceArticleStatDTO(i *biz.SourceArticleStat) *v1.SourceArticleStat {
	if i == nil {
		return nil
	}
	return &v1.SourceArticleStat{
		Rank:          i.Rank,
		Title:         i.Title,
		CitationCount: i.CitationCount,
		ArticleId:     i.ArticleID,
		Url:           i.URL,
	}
}

func articlePublishTrendPointDTO(i *biz.ArticlePublishTrendPoint) *v1.ArticlePublishTrendPoint {
	if i == nil {
		return nil
	}
	return &v1.ArticlePublishTrendPoint{Date: i.Date, Count: i.Count}
}

func sourcePlatformStatDTO(i *biz.SourcePlatformStat) *v1.SourcePlatformStat {
	if i == nil {
		return nil
	}
	return &v1.SourcePlatformStat{
		Rank:          i.Rank,
		Domain:        i.Domain,
		CitationCount: i.CitationCount,
		Title:         i.Title,
	}
}

func brandSourceAnalysisDTO(i *biz.BrandSourceAnalysis) *v1.BrandSourceAnalysis {
	if i == nil {
		return nil
	}
	o := &v1.BrandSourceAnalysis{
		ArticlePublishCount:  i.ArticlePublishCount,
		ArticleCitationCount: i.ArticleCitationCount,
		SourceReferenceCount: i.SourceReferenceCount,
		MediaBreakdown:       mediaArticleBreakdownDTO(i.MediaBreakdown),
		TopArticles:          make([]*v1.SourceArticleStat, 0, len(i.TopArticles)),
		PublishTrend:         make([]*v1.ArticlePublishTrendPoint, 0, len(i.PublishTrend)),
		TopSourcePlatforms:   make([]*v1.SourcePlatformStat, 0, len(i.TopSourcePlatforms)),
	}
	for _, a := range i.TopArticles {
		o.TopArticles = append(o.TopArticles, sourceArticleStatDTO(a))
	}
	for _, p := range i.PublishTrend {
		o.PublishTrend = append(o.PublishTrend, articlePublishTrendPointDTO(p))
	}
	for _, s := range i.TopSourcePlatforms {
		o.TopSourcePlatforms = append(o.TopSourcePlatforms, sourcePlatformStatDTO(s))
	}
	return o
}
