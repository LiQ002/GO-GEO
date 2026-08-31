package data

import (
	"context"
	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/data/model"
	"strconv"
	"time"
)

type dashboardRepo struct{ data *Data }

func NewDashboardRepo(data *Data) biz.DashboardRepo { return &dashboardRepo{data: data} }
func (r *dashboardRepo) Get(ctx context.Context, days int) (*biz.PlatformDashboard, error) {
	db := r.data.DB(ctx)
	now := time.Now().UTC()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	metrics := []struct {
		key, label string
		model      any
		where      string
		args       []any
	}{{"enterprises", "企业总数", &model.Enterprise{}, "deleted_at IS NULL", nil}, {"pending_articles", "待审核文章", &model.Article{}, "status IN ?", []any{[]string{"draft", "pending_review"}}}, {"failed_publish", "发布失败", &model.PublishTask{}, "status = ?", []any{"failed"}}, {"failed_geo", "GEO 失败", &model.GEOTask{}, "status = ?", []any{"failed"}}, {"online_workers", "在线节点", &model.WorkerNode{}, "status = ? AND last_heartbeat_at >= ?", []any{"active", now.Add(-5 * time.Minute)}}, {"open_alerts", "未处理告警", &model.Alert{}, "status = ?", []any{"open"}}}
	out := &biz.PlatformDashboard{GeneratedAt: now, Metrics: []*biz.DashboardMetric{}, Trends: []*biz.DashboardTrend{}, Alerts: []*biz.DashboardAlert{}}
	for _, m := range metrics {
		var value int64
		q := db.Model(m.model)
		if m.where != "" {
			q = q.Where(m.where, m.args...)
		}
		if err := q.Count(&value).Error; err != nil {
			return nil, err
		}
		out.Metrics = append(out.Metrics, &biz.DashboardMetric{Key: m.key, Label: m.label, Value: value})
	}
	type trendRow struct {
		Date  time.Time
		Count int64
	}
	start := today.AddDate(0, 0, -days+1)
	maps := map[string]map[string]int64{"articles": {}, "publish": {}, "geo": {}, "failed": {}}
	queries := []struct {
		key   string
		model any
		where string
		args  []any
	}{{"articles", &model.Article{}, "created_at >= ?", []any{start}}, {"publish", &model.PublishTask{}, "created_at >= ? AND status = ?", []any{start, "succeeded"}}, {"geo", &model.GEOTask{}, "created_at >= ? AND status = ?", []any{start, "succeeded"}}, {"failed", &model.PublishTask{}, "created_at >= ? AND status = ?", []any{start, "failed"}}}
	for _, qv := range queries {
		var rows []trendRow
		if err := db.Model(qv.model).Select("DATE(created_at) AS date, COUNT(*) AS count").Where(qv.where, qv.args...).Group("DATE(created_at)").Scan(&rows).Error; err != nil {
			return nil, err
		}
		for _, v := range rows {
			maps[qv.key][v.Date.Format("2006-01-02")] = v.Count
		}
	}
	var geoFailed []trendRow
	if err := db.Model(&model.GEOTask{}).Select("DATE(created_at) AS date, COUNT(*) AS count").Where("created_at >= ? AND status = ?", start, "failed").Group("DATE(created_at)").Scan(&geoFailed).Error; err != nil {
		return nil, err
	}
	for _, v := range geoFailed {
		maps["failed"][v.Date.Format("2006-01-02")] += v.Count
	}
	for i := 0; i < days; i++ {
		date := start.AddDate(0, 0, i).Format("2006-01-02")
		out.Trends = append(out.Trends, &biz.DashboardTrend{Date: date, Articles: maps["articles"][date], PublishSucceeded: maps["publish"][date], GeoSucceeded: maps["geo"][date], FailedTasks: maps["failed"][date]})
	}
	var alerts []model.Alert
	if err := db.Where("status = ?", "open").Order("FIELD(severity, 'critical', 'high', 'medium', 'low'), id DESC").Limit(10).Find(&alerts).Error; err != nil {
		return nil, err
	}
	for i := range alerts {
		v := &alerts[i]
		out.Alerts = append(out.Alerts, &biz.DashboardAlert{ID: v.ID, Severity: v.Severity, Title: v.Title, ResourceType: v.ResourceType, ResourceID: v.ResourceID, CreatedAt: v.CreatedAt})
	}
	type platformStatRow struct {
		Platform string
		Label    string
		Count    int64
		Success  int64
	}
	var platformRows []platformStatRow
	if err := db.Table(model.TablePublishTasks + " AS t").
		Select("c.code AS platform, c.name AS label, COUNT(*) AS count, SUM(CASE WHEN t.status = 'succeeded' THEN 1 ELSE 0 END) AS success").
		Joins("LEFT JOIN " + model.TablePublishChannels + " AS c ON c.id = t.publish_channel_id AND c.deleted_at IS NULL").
		Group("c.code, c.name").
		Order("count DESC").
		Limit(10).
		Scan(&platformRows).Error; err != nil {
		return nil, err
	}
	for _, v := range platformRows {
		rate := float64(0)
		if v.Count > 0 {
			rate = float64(v.Success) / float64(v.Count)
		}
		out.PlatformStats = append(out.PlatformStats, &biz.DashboardPlatformStat{Platform: v.Platform, Label: v.Label, Count: v.Count, SuccessRate: rate})
	}
	type activityRow struct {
		ID        uint64
		Status    string
		Title     string
		Channel   string
		CreatedAt time.Time
	}
	var activityRows []activityRow
	if err := db.Table(model.TablePublishTasks + " AS t").
		Select("t.id, t.status, t.created_at, a.title, c.name AS channel").
		Joins("LEFT JOIN " + model.TableArticleSnapshots + " AS s ON s.id = t.article_snapshot_id").
		Joins("LEFT JOIN " + model.TableArticles + " AS a ON a.id = s.article_id").
		Joins("LEFT JOIN " + model.TablePublishChannels + " AS c ON c.id = t.publish_channel_id").
		Order("t.id DESC").
		Limit(10).
		Scan(&activityRows).Error; err != nil {
		return nil, err
	}
	for _, v := range activityRows {
		actType := "started"
		message := "发布任务 #" + strconv.FormatUint(v.ID, 10)
		if v.Title != "" {
			message = "《" + v.Title + "》"
		}
		if v.Channel != "" {
			message += " 发布到 " + v.Channel
		}
		switch v.Status {
		case "succeeded":
			actType = "success"
			message += " 成功"
		case "failed", "manual_action_required", "expired":
			actType = "failed"
			message += " 失败"
		default:
			actType = "started"
			message += " 进行中"
		}
		out.Activities = append(out.Activities, &biz.DashboardActivity{ID: v.ID, Type: actType, Message: message, CreatedAt: v.CreatedAt})
	}
	return out, nil
}
