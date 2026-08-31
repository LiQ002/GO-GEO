package data

import (
	"context"
	"errors"
	"fmt"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/data/model"
)

type questionRepo struct{ data *Data }

func NewQuestionRepo(d *Data) biz.QuestionRepo { return &questionRepo{data: d} }
func (r *questionRepo) Create(c context.Context, i *biz.Question) (*biz.Question, error) {
	var po *model.Question
	x := r.data.WithinTransaction(c, func(tx *gorm.DB) error {
		// 校验词条数配额（article_generations）
		if e := reserveQuota(tx, i.EnterpriseID, "article_generations", 1); e != nil {
			// 转换错误：reserveQuota 内部用 ErrPublishQuota（reason code PUBLISH_QUOTA_EXCEEDED），
			// 在词条数场景下用 ErrArticleGenerationsQuotaExceeded 文案更合适，
			// 提示用户可通过"管理词条"删除多余词条来腾出空间。
			if errors.Is(e, biz.ErrPublishQuota) {
				return biz.ErrArticleGenerationsQuotaExceeded
			}
			return e
		}
		p := questionPO(i)
		if e := tx.Create(p).Error; e != nil {
			return e
		}
		po = p
		// 创建成功后立即结算配额
		return settleQuota(tx, i.EnterpriseID, "article_generations", 1, "question", p.ID, fmt.Sprintf("question-create-%d", p.ID))
	})
	if x != nil {
		return nil, mapQuestionError(x)
	}
	return questionDO(po), nil
}
func (r *questionRepo) Get(c context.Context, e, id uint64) (*biz.Question, error) {
	var p model.Question
	if x := r.data.DB(c).Where("enterprise_id = ? AND id = ?", e, id).First(&p).Error; x != nil {
		return nil, mapQuestionError(x)
	}
	return questionDO(&p), nil
}
func (r *questionRepo) List(c context.Context, e uint64, o biz.QuestionListOptions) ([]*biz.Question, int64, error) {
	db := r.data.DB(c).Model(&model.Question{}).Where("enterprise_id = ?", e)
	if o.BrandID != 0 {
		db = db.Where("brand_id = ?", o.BrandID)
	}
	if o.KeywordID != 0 {
		db = db.Where("keyword_id = ?", o.KeywordID)
	}
	if o.Status != 0 {
		db = db.Where("status = ?", o.Status)
	}
	if o.Keyword != "" {
		db = db.Where("text LIKE ?", "%"+o.Keyword+"%")
	}
	var total int64
	if x := db.Count(&total).Error; x != nil {
		return nil, 0, x
	}
	var rows []model.Question
	if x := db.Order("created_at DESC, id DESC").Offset(o.Offset).Limit(o.Limit).Find(&rows).Error; x != nil {
		return nil, 0, x
	}
	out := make([]*biz.Question, 0, len(rows))
	for j := range rows {
		out = append(out, questionDO(&rows[j]))
	}
	return out, total, nil
}
func (r *questionRepo) Update(c context.Context, i *biz.Question) (*biz.Question, error) {
	u := map[string]any{"keyword_id": i.KeywordID, "brand_id": i.BrandID, "text": i.Text, "region": i.Region, "status": i.Status, "intent": i.Intent, "audience": i.Audience, "funnel_stage": i.FunnelStage, "cluster_code": i.ClusterCode, "priority": i.Priority, "sort_order": i.SortOrder, "version": gorm.Expr("version + 1")}
	res := r.data.DB(c).Model(&model.Question{}).Where("enterprise_id = ? AND id = ? AND version = ?", i.EnterpriseID, i.ID, i.Version).Updates(u)
	if res.Error != nil {
		return nil, mapQuestionError(res.Error)
	}
	if res.RowsAffected != 1 {
		return nil, biz.ErrQuestionConflict
	}
	return r.Get(c, i.EnterpriseID, i.ID)
}
func (r *questionRepo) Delete(c context.Context, e, id, v uint64) error {
	x := r.data.WithinTransaction(c, func(tx *gorm.DB) error {
		res := tx.Where("enterprise_id = ? AND id = ? AND version = ?", e, id, v).Delete(&model.Question{})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected != 1 {
			return biz.ErrQuestionConflict
		}
		// 释放词条数配额（article_generations）
		return releaseUsedQuota(tx, e, "article_generations", 1, "question", id, fmt.Sprintf("question-delete-%d", id))
	})
	if x != nil {
		return mapQuestionError(x)
	}
	return nil
}
func (r *questionRepo) Review(c context.Context, e, id, v uint64, action, reason string) (*biz.Question, error) {
	x := r.data.WithinTransaction(c, func(tx *gorm.DB) error {
		var q model.Question
		if z := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("enterprise_id = ? AND id = ? AND version = ?", e, id, v).First(&q).Error; z != nil {
			return z
		}
		status := biz.QuestionStatusApproved
		if action == "reject" {
			status = biz.QuestionStatusRejected
		}
		if z := tx.Model(&q).Updates(map[string]any{"status": status, "version": gorm.Expr("version + 1")}).Error; z != nil {
			return z
		}
		history := &model.QuestionVersion{ImmutableTenantModel: model.ImmutableTenantModel{EnterpriseID: e}, QuestionID: id, VersionNumber: uint32(v + 1), Text: q.Text, MetadataJSON: []byte(`{"action":"` + action + `","reason":` + quoteJSON(reason) + `}`), OperatorType: "enterprise", OperatorID: e, Reason: reason}
		return tx.Create(history).Error
	})
	if x != nil {
		return nil, mapQuestionError(x)
	}
	return r.Get(c, e, id)
}
func questionPO(i *biz.Question) *model.Question {
	var taskID *uint64
	if i.DistillationTaskID != 0 {
		taskID = &i.DistillationTaskID
	}
	return &model.Question{TenantModel: model.TenantModel{EnterpriseID: i.EnterpriseID}, KeywordID: i.KeywordID, BrandID: i.BrandID, Text: i.Text, Region: i.Region, Source: i.Source, DistillationTaskID: taskID, Status: i.Status, Intent: i.Intent, Audience: i.Audience, FunnelStage: i.FunnelStage, ClusterCode: i.ClusterCode, Priority: i.Priority, SortOrder: i.SortOrder, Version: 1}
}
func questionDO(i *model.Question) *biz.Question {
	taskID := uint64(0)
	if i.DistillationTaskID != nil {
		taskID = *i.DistillationTaskID
	}
	return &biz.Question{ID: i.ID, EnterpriseID: i.EnterpriseID, KeywordID: i.KeywordID, BrandID: i.BrandID, DistillationTaskID: taskID, Text: i.Text, Region: i.Region, Source: i.Source, Status: i.Status, Intent: i.Intent, Audience: i.Audience, FunnelStage: i.FunnelStage, ClusterCode: i.ClusterCode, Priority: i.Priority, SortOrder: i.SortOrder, Version: i.Version, CreatedAt: i.CreatedAt, UpdatedAt: i.UpdatedAt}
}
func mapQuestionError(e error) error {
	if errors.Is(e, gorm.ErrRecordNotFound) {
		return biz.ErrQuestionNotFound
	}
	if errors.Is(e, gorm.ErrDuplicatedKey) {
		return biz.ErrQuestionConflict
	}
	return e
}
func quoteJSON(s string) string {
	b := make([]byte, 0, len(s)+2)
	b = append(b, '"')
	for _, c := range []byte(s) {
		if c == '"' || c == '\\' {
			b = append(b, '\\')
		}
		b = append(b, c)
	}
	b = append(b, '"')
	return string(b)
}
