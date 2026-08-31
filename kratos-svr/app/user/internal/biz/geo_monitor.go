package biz

import (
	"context"
	"encoding/json"
	"github.com/go-kratos/kratos/v3/errors"
	"time"
)

var (
	ErrMonitorPlanNotFound = errors.NotFound("MONITOR_PLAN_NOT_FOUND", "monitor plan not found")
	ErrMonitorPlanInvalid  = errors.BadRequest("MONITOR_PLAN_INVALID", "invalid monitor plan")
	ErrMonitorPlanConflict = errors.Conflict("MONITOR_PLAN_CONFLICT", "monitor plan version conflict")
)

type MonitorPlan struct {
	ID, EnterpriseID, BrandID                                                         uint64
	Name, CronExpression, Timezone, QuestionIDsJSON, SiteTargetsJSON, ClientRequestID string
	Status, ScheduleType, MonitorTerminal                                             int32
	NextRunAt, LastRunAt                                                              *time.Time
	Version                                                                           uint64
	CreatedAt                                                                         time.Time
}
type GeoTask struct {
	ID, EnterpriseID, MonitorPlanID, BrandID, QuestionID, InclusionSiteID, PlatformAccountID uint64
	ModelEntry, Locale, Region, Status, ErrorCategory, ErrorCode, ErrorMessage, SessionRef    string
	Priority                                                                                 int32
	TerminalType                                                                             int32
	ScheduledAt                                                                              time.Time
	CompletedAt                                                                              *time.Time
	BrandMentioned                                                                           bool
}
type Citation struct {
	URL, Domain, Title string
	Position           uint32
	EnterpriseSource   bool
	ArticleID          uint64
}
type Mention struct {
	EntityType string
	EntityID   uint64
	Text       string
	Position   uint32
	Sentiment  string
	Confidence float64
}
type GeoAnswer struct {
	SnapshotID, TaskID                                                       uint64
	QuestionText, AnswerText, AnswerStatus, ScreenshotKey, EvidenceJSON, SessionRef string
	ObservedAt                                                               time.Time
	Citations                                                                []Citation
	Mentions                                                                 []Mention
	VisibilityScore, AccuracyScore, Confidence                               float64
}
type GeoMetrics struct {
	TotalAnswers, ValidAnswers                                                   int64
	BrandMentionRate, CitationRate, QuestionCoverageRate, AverageVisibilityScore float64
}
type GeoTrendPoint struct {
	Date    string
	Metrics GeoMetrics
}
type GeoSitePerformance struct {
	InclusionSiteID   uint64
	InclusionSiteName string
	Metrics           GeoMetrics
}
// Dashboard 数据看板聚合数据。
type DashboardCompanyCard struct {
	EnterpriseName  string
	OnlineAt        *time.Time
	ExpireAt        *time.Time
	Contact         string
	Website         string
	AITrainingCount int64
	BrandName       string
	BrandNames      []string
	Keywords        []string
	KeywordCount    int64
	QuestionCount   int64
}
type DashboardOverview struct {
	TotalIncluded     int64
	RecentIncluded    int64
	PublishedArticles int64
	ContactExposure   int64
}
type DashboardTrendPoint struct {
	Date     string
	Included int64
}
type DashboardSiteStat struct {
	InclusionSiteID uint64
	SiteName        string
	Included        int64
}
type DashboardTopKeyword struct {
	KeywordID      uint64
	Keyword        string
	IncludedCount  int64
}
type GeoDashboard struct {
	Company      DashboardCompanyCard
	Overview     DashboardOverview
	Trend        []*DashboardTrendPoint
	SiteStats    []*DashboardSiteStat
	TopKeywords  []*DashboardTopKeyword
	Tasks        []*GeoTask
	NextPageToken string
	TotalSize     int64
	UpdatedAt     time.Time
}
type DashboardOptions struct {
	Range          string // 7d / month / year
	PageSize       int
	PageToken      string
	InclusionSiteID uint64
}
type MonitorListOptions struct {
	Offset, Limit int
	BrandID       uint64
	Status        int32
}
type GeoTaskListOptions struct {
	Offset, Limit                  int
	MonitorPlanID, InclusionSiteID uint64
	Status                         string
}
type MetricsFilter struct {
	BrandID, InclusionSiteID uint64
	From, To                 time.Time
}
type GeoMonitorRepo interface {
	CreatePlan(context.Context, *MonitorPlan) (*MonitorPlan, error)
	GetPlan(context.Context, uint64, uint64) (*MonitorPlan, error)
	// UpdatePlan 修改计划可变字段（目前仅 name）并基于 version 做乐观锁。
	UpdatePlan(context.Context, *MonitorPlan) (*MonitorPlan, error)
	// DeletePlan 删除监测计划及其关联的任务。
	DeletePlan(context.Context, uint64, uint64) error
	ListPlans(context.Context, uint64, MonitorListOptions) ([]*MonitorPlan, int64, error)
	ChangePlanStatus(context.Context, uint64, uint64, uint64, string) (*MonitorPlan, error)
	ListTasks(context.Context, uint64, GeoTaskListOptions) ([]*GeoTask, int64, error)
	GetAnswer(context.Context, uint64, uint64) (*GeoAnswer, error)
	GetMetrics(context.Context, uint64, MetricsFilter) (*GeoMetrics, error)
	ListTrend(context.Context, uint64, MetricsFilter) ([]*GeoTrendPoint, error)
	ListSitePerformance(context.Context, uint64, MetricsFilter) ([]*GeoSitePerformance, error)
	// ListDuePlans returns active plans whose next_run_at has arrived.
	ListDuePlans(context.Context, time.Time, int) ([]*MonitorPlan, error)
	// GenerateTasksForPlan creates one cycle of geo_tasks (question × site matrix),
	// reserves quota and writes the usage ledger + outbox event atomically.
	// Returns the number of tasks created.
	GenerateTasksForPlan(context.Context, *MonitorPlan, time.Time) (int, error)
	// UpdatePlanSchedule updates last_run_at and next_run_at after a cycle.
	UpdatePlanSchedule(context.Context, uint64, uint64, *time.Time, *time.Time) error
	// PausePlanDueToQuota marks a plan as paused when quota is exhausted.
	PausePlanDueToQuota(context.Context, uint64, uint64) error
	// GetDashboard 聚合企业 GEO 数据看板。
	GetDashboard(context.Context, uint64, DashboardOptions) (*GeoDashboard, error)
}
type GeoMonitorUsecase struct{ repo GeoMonitorRepo }

func NewGeoMonitorUsecase(r GeoMonitorRepo) *GeoMonitorUsecase { return &GeoMonitorUsecase{repo: r} }
func (u *GeoMonitorUsecase) Create(c context.Context, p *MonitorPlan) (*MonitorPlan, error) {
	if p != nil && p.Status == 0 {
		p.Status = MonitorPlanStatusActive
	}
	if p == nil {
		return nil, errors.BadRequest("MONITOR_PLAN_INVALID", "invalid monitor plan: plan is empty")
	}
	if p.EnterpriseID == 0 {
		return nil, errors.BadRequest("MONITOR_PLAN_INVALID", "invalid monitor plan: enterprise id is 0")
	}
	if p.BrandID == 0 {
		return nil, errors.BadRequest("MONITOR_PLAN_INVALID", "invalid monitor plan: brand id is 0")
	}
	if p.ClientRequestID == "" {
		return nil, errors.BadRequest("MONITOR_PLAN_INVALID", "invalid monitor plan: client request id is empty")
	}
	if !json.Valid([]byte(p.QuestionIDsJSON)) {
		return nil, errors.BadRequest("MONITOR_PLAN_INVALID", "invalid monitor plan: question_ids_json is not valid json")
	}
	if !json.Valid([]byte(p.SiteTargetsJSON)) {
		return nil, errors.BadRequest("MONITOR_PLAN_INVALID", "invalid monitor plan: site_targets_json is not valid json")
	}
	if !validMonitorPlanStatus(p.Status) {
		return nil, errors.BadRequest("MONITOR_PLAN_INVALID", "invalid monitor plan: status is out of range")
	}
	if !validMonitorScheduleType(p.ScheduleType) {
		return nil, errors.BadRequest("MONITOR_PLAN_INVALID", "invalid monitor plan: schedule_type is out of range")
	}
	// once/manual 类型没有后续周期：首批任务在 CreatePlan 中已立即创建，
	// next_run_at 必须为 NULL，否则 scheduler 的 ListDuePlans 会查到该 plan
	// 并调用 GenerateTasksForPlan 重复创建一批任务（竞态：CreatePlan 与
	// UpdatePlanSchedule 之间存在时间窗口）。
	if p.ScheduleType == MonitorScheduleOnce || p.ScheduleType == MonitorScheduleManual {
		p.NextRunAt = nil
	}

	plan, err := u.repo.CreatePlan(c, p)
	if err != nil {
		return nil, err
	}

	// 周期类型（hourly/daily/weekly/monthly/cron）需要立即更新 next_run_at
	// 为下一次运行时间，避免 scheduler 扫描到同一 plan 并重复创建任务。
	if p.ScheduleType != MonitorScheduleOnce && p.ScheduleType != MonitorScheduleManual {
		now := time.Now().UTC()
		lastRun := now
		nextRun := calcNextRun(plan, now)
		if e := u.repo.UpdatePlanSchedule(c, plan.ID, plan.Version, &lastRun, nextRun); e != nil {
			_ = e
		}
	}
	return u.repo.GetPlan(c, plan.EnterpriseID, plan.ID)
}
// Update 修改监测计划可变字段，当前仅允许更新 name；version 必填做乐观锁。
func (u *GeoMonitorUsecase) Update(c context.Context, p *MonitorPlan) (*MonitorPlan, error) {
	if p == nil {
		return nil, errors.BadRequest("MONITOR_PLAN_INVALID", "invalid monitor plan: plan is empty")
	}
	if p.ID == 0 || p.EnterpriseID == 0 {
		return nil, errors.BadRequest("MONITOR_PLAN_INVALID", "invalid monitor plan: missing id or enterprise")
	}
	if p.Name == "" {
		return nil, errors.BadRequest("MONITOR_PLAN_INVALID", "invalid monitor plan: name is empty")
	}
	if p.Version == 0 {
		return nil, errors.BadRequest("MONITOR_PLAN_INVALID", "invalid monitor plan: version is required for optimistic lock")
	}
	return u.repo.UpdatePlan(c, p)
}

// Delete 删除监测计划及其关联的所有任务。
func (u *GeoMonitorUsecase) Delete(c context.Context, e, id uint64) error {
	if e == 0 || id == 0 {
		return ErrMonitorPlanInvalid
	}
	_, err := u.repo.GetPlan(c, e, id)
	if err != nil {
		return err
	}
	return u.repo.DeletePlan(c, e, id)
}
func (u *GeoMonitorUsecase) Get(c context.Context, e, id uint64) (*MonitorPlan, error) {
	return u.repo.GetPlan(c, e, id)
}
func (u *GeoMonitorUsecase) List(c context.Context, e uint64, o MonitorListOptions) ([]*MonitorPlan, int64, error) {
	return u.repo.ListPlans(c, e, o)
}
func (u *GeoMonitorUsecase) Change(c context.Context, e, id, v uint64, a string) (*MonitorPlan, error) {
	if !map[string]bool{"pause": true, "resume": true, "stop": true}[a] {
		return nil, ErrMonitorPlanInvalid
	}
	return u.repo.ChangePlanStatus(c, e, id, v, a)
}
func (u *GeoMonitorUsecase) Tasks(c context.Context, e uint64, o GeoTaskListOptions) ([]*GeoTask, int64, error) {
	return u.repo.ListTasks(c, e, o)
}
func (u *GeoMonitorUsecase) Answer(c context.Context, e, id uint64) (*GeoAnswer, error) {
	return u.repo.GetAnswer(c, e, id)
}
func (u *GeoMonitorUsecase) Metrics(c context.Context, e uint64, f MetricsFilter) (*GeoMetrics, error) {
	if e == 0 || invalidMetricsRange(f) {
		return nil, ErrMonitorPlanInvalid
	}
	return u.repo.GetMetrics(c, e, f)
}

func (u *GeoMonitorUsecase) ReportMetrics(c context.Context, e uint64, f MetricsFilter) (*GeoMetrics, MetricsFilter, error) {
	f, err := normalizeReportRange(e, f)
	if err != nil {
		return nil, MetricsFilter{}, err
	}
	metrics, err := u.repo.GetMetrics(c, e, f)
	return metrics, f, err
}

func (u *GeoMonitorUsecase) ReportTrend(c context.Context, e uint64, f MetricsFilter) ([]*GeoTrendPoint, MetricsFilter, error) {
	f, err := normalizeReportRange(e, f)
	if err != nil {
		return nil, MetricsFilter{}, err
	}
	items, err := u.repo.ListTrend(c, e, f)
	return items, f, err
}

func (u *GeoMonitorUsecase) ReportSitePerformance(c context.Context, e uint64, f MetricsFilter) ([]*GeoSitePerformance, MetricsFilter, error) {
	f, err := normalizeReportRange(e, f)
	if err != nil {
		return nil, MetricsFilter{}, err
	}
	items, err := u.repo.ListSitePerformance(c, e, f)
	return items, f, err
}

// Dashboard 获取企业 GEO 数据看板聚合数据。
func (u *GeoMonitorUsecase) Dashboard(c context.Context, e uint64, o DashboardOptions) (*GeoDashboard, error) {
	if e == 0 {
		return nil, ErrMonitorPlanInvalid
	}
	if o.Range == "" {
		o.Range = "7d"
	}
	if o.PageSize == 0 {
		o.PageSize = 10
	}
	return u.repo.GetDashboard(c, e, o)
}

func normalizeReportRange(enterpriseID uint64, filter MetricsFilter) (MetricsFilter, error) {
	if enterpriseID == 0 || invalidMetricsRange(filter) {
		return MetricsFilter{}, ErrMonitorPlanInvalid
	}
	if filter.To.IsZero() {
		filter.To = time.Now().UTC()
	}
	if filter.From.IsZero() {
		filter.From = filter.To.AddDate(0, 0, -30)
	}
	if filter.To.Sub(filter.From) > 366*24*time.Hour {
		return MetricsFilter{}, ErrMonitorPlanInvalid
	}
	return filter, nil
}

func invalidMetricsRange(filter MetricsFilter) bool {
	return !filter.From.IsZero() && !filter.To.IsZero() && !filter.From.Before(filter.To)
}
