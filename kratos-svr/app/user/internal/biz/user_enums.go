package biz

// User-facing enum values start at 1. Zero is reserved for an unspecified
// filter or an invalid persisted value.
const (
	BrandStatusActive   int32 = 1
	BrandStatusArchived int32 = 2

	KnowledgeBaseStatusActive   int32 = 1
	KnowledgeBaseStatusArchived int32 = 2

	KnowledgeSourceTypeText int32 = 1
	KnowledgeSourceTypeURL  int32 = 2
	KnowledgeSourceTypeFile int32 = 3

	KnowledgeParseStatusPending int32 = 1
	KnowledgeParseStatusParsing int32 = 2
	KnowledgeParseStatusParsed  int32 = 3
	KnowledgeParseStatusFailed  int32 = 4

	KnowledgeCategoryEnterpriseProfile int32 = 1
	KnowledgeCategoryBrandPositioning  int32 = 2
	KnowledgeCategoryProductOverview   int32 = 3
	KnowledgeCategoryProductAdvantages int32 = 4
	KnowledgeCategoryTargetAudience    int32 = 5
	KnowledgeCategoryUseCases          int32 = 6
	KnowledgeCategoryCustomerCases     int32 = 7
	KnowledgeCategoryFactsCredentials  int32 = 8
	KnowledgeCategoryFAQ               int32 = 9
	KnowledgeCategoryIndustryInsights  int32 = 10
	KnowledgeCategoryBrandVoice        int32 = 11
	KnowledgeCategoryCompliance        int32 = 12

	QuestionStatusPending  int32 = 1
	QuestionStatusApproved int32 = 2
	QuestionStatusRejected int32 = 3

	QuestionIntentEducation  int32 = 1
	QuestionIntentResearch   int32 = 2
	QuestionIntentComparison int32 = 3
	QuestionIntentPurchase   int32 = 4

	QuestionFunnelAwareness     int32 = 1
	QuestionFunnelConsideration int32 = 2
	QuestionFunnelDecision      int32 = 3

	PublishPlanStatusPending   int32 = 1
	PublishPlanStatusActive    int32 = 2
	PublishPlanStatusPaused    int32 = 3
	PublishPlanStatusStopped   int32 = 4
	PublishPlanStatusCancelled int32 = 5
	PublishPlanStatusCompleted int32 = 6 // 所有 task 进入终态后自动置此状态

	PublishScheduleImmediate int32 = 1
	PublishScheduleScheduled int32 = 2

	// 文章状态三态（与迁移 000033 对齐，不再使用 published 状态）
	ArticleStatusPendingReview string = "pending_review"
	ArticleStatusNormal        string = "normal"
	ArticleStatusDisabled      string = "disabled"

	// 投放任务去重策略
	DedupStrategyNone        string = "no_dedup"      // 不去重：允许重复发布
	DedupStrategyAllUnique   string = "all_unique"    // 全部去重：同文章只能出现一次
	DedupStrategyPerPlatform string = "per_platform"  // 单平台去重：同文章可发不同平台，同平台不重复

	MonitorPlanStatusActive  int32 = 1
	MonitorPlanStatusPaused  int32 = 2
	MonitorPlanStatusStopped int32 = 3

	MonitorScheduleOnce    int32 = 1
	MonitorScheduleManual  int32 = 2
	MonitorScheduleHourly  int32 = 3
	MonitorScheduleDaily   int32 = 4
	MonitorScheduleWeekly  int32 = 5
	MonitorScheduleMonthly int32 = 6
	MonitorScheduleCron    int32 = 7

	AuthorizationResourcePublishChannel int32 = 1
	AuthorizationResourceInclusionSite  int32 = 2

	AuthorizationStatusPending     int32 = 1
	AuthorizationStatusAuthorizing int32 = 2
	AuthorizationStatusActive      int32 = 3
	AuthorizationStatusExpired     int32 = 4
	AuthorizationStatusRevoked     int32 = 5
	AuthorizationStatusFailed      int32 = 6

	AuthorizationUsageEnabled  int32 = 1
	AuthorizationUsagePaused   int32 = 2
	AuthorizationUsageDisabled int32 = 3

	AuthorizationSessionPending     int32 = 1
	AuthorizationSessionAuthorizing int32 = 2
	AuthorizationSessionCompleted   int32 = 3
	AuthorizationSessionExpired     int32 = 4
	AuthorizationSessionFailed      int32 = 5
)

func validBrandStatus(value int32) bool {
	return value == BrandStatusActive || value == BrandStatusArchived
}

func validKnowledgeBaseStatus(value int32) bool {
	return value == KnowledgeBaseStatusActive || value == KnowledgeBaseStatusArchived
}

func validKnowledgeSourceType(value int32) bool {
	return value >= KnowledgeSourceTypeText && value <= KnowledgeSourceTypeFile
}

func validKnowledgeCategory(value int32) bool {
	return value >= KnowledgeCategoryEnterpriseProfile && value <= KnowledgeCategoryCompliance
}

// KnowledgeCategoryLabel returns the stable, user-facing category name used in
// article-generation context. Keeping this mapping in the domain layer makes
// prompt snapshots understandable without coupling them to the console UI.
func KnowledgeCategoryLabel(value int32) string {
	switch value {
	case KnowledgeCategoryBrandPositioning:
		return "品牌定位"
	case KnowledgeCategoryProductOverview:
		return "产品介绍"
	case KnowledgeCategoryProductAdvantages:
		return "产品优势"
	case KnowledgeCategoryTargetAudience:
		return "目标客户"
	case KnowledgeCategoryUseCases:
		return "应用场景与解决方案"
	case KnowledgeCategoryCustomerCases:
		return "客户案例"
	case KnowledgeCategoryFactsCredentials:
		return "事实数据与资质"
	case KnowledgeCategoryFAQ:
		return "常见问题"
	case KnowledgeCategoryIndustryInsights:
		return "行业知识与观点"
	case KnowledgeCategoryBrandVoice:
		return "品牌语气与内容规范"
	case KnowledgeCategoryCompliance:
		return "合规边界"
	default:
		return "企业介绍"
	}
}

func validQuestionStatus(value int32) bool {
	return value >= QuestionStatusPending && value <= QuestionStatusRejected
}

func validQuestionIntent(value int32) bool {
	return value >= QuestionIntentEducation && value <= QuestionIntentPurchase
}

func validQuestionFunnel(value int32) bool {
	return value >= QuestionFunnelAwareness && value <= QuestionFunnelDecision
}

func validPublishPlanStatus(value int32) bool {
	return value >= PublishPlanStatusPending && value <= PublishPlanStatusCompleted
}

func validMonitorPlanStatus(value int32) bool {
	return value >= MonitorPlanStatusActive && value <= MonitorPlanStatusStopped
}

func validMonitorScheduleType(value int32) bool {
	return value >= MonitorScheduleOnce && value <= MonitorScheduleCron
}

func validAuthorizationResourceType(value int32) bool {
	return value == AuthorizationResourcePublishChannel || value == AuthorizationResourceInclusionSite
}
