package data

import (
	"context"
	stderrors "errors"
	"fmt"
	"gorm.io/gorm"
	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/data/model"
	"strings"
)

type keywordRepo struct{ data *Data }

func NewKeywordRepo(d *Data) biz.KeywordRepo { return &keywordRepo{data: d} }
func (r *keywordRepo) Create(c context.Context, i *biz.Keyword) (*biz.Keyword, error) {
	var po *model.Keyword
	x := r.data.WithinTransaction(c, func(tx *gorm.DB) error {
		// 根据关键词来源确定配额指标
		metric := keywordMetricBySource(i.Source)
		if metric != "" {
			if e := reserveQuota(tx, i.EnterpriseID, metric, 1); e != nil {
				return e
			}
		}
		p := keywordPO(i)
		if e := tx.Create(p).Error; e != nil {
			return e
		}
		po = p
		if metric != "" {
			return settleQuota(tx, i.EnterpriseID, metric, 1, "keyword", p.ID, fmt.Sprintf("keyword-create-%d", p.ID))
		}
		return nil
	})
	if x != nil {
		return nil, mapKeywordError(x)
	}
	return keywordDO(po), nil
}

// keywordMetricBySource 根据关键词来源映射到配额指标字符串。
// 所有关键词统一使用 custom_keywords 配额指标
func keywordMetricBySource(source string) string {
	switch source {
	case "product", "ai_derived", "manual":
		return "custom_keywords"
	case "":
		return "custom_keywords"
	default:
		return "custom_keywords"
	}
}
func (r *keywordRepo) Get(c context.Context, e, id uint64) (*biz.Keyword, error) {
	var p model.Keyword
	if x := r.data.DB(c).Where("enterprise_id = ? AND id = ?", e, id).First(&p).Error; x != nil {
		return nil, mapKeywordError(x)
	}
	return keywordDO(&p), nil
}
func (r *keywordRepo) List(c context.Context, e uint64, o biz.KeywordListOptions) ([]*biz.Keyword, int64, error) {
	db := r.data.DB(c).Model(&model.Keyword{}).Where("enterprise_id = ?", e)
	if o.BrandID != 0 {
		db = db.Where("brand_id = ?", o.BrandID)
	}
	if o.Status != "" {
		db = db.Where("status = ?", o.Status)
	}
	if o.Keyword != "" {
		db = db.Where("text LIKE ?", "%"+o.Keyword+"%")
	}
	var total int64
	if x := db.Count(&total).Error; x != nil {
		return nil, 0, x
	}
	var rows []model.Keyword
	if x := db.Order("created_at DESC, id DESC").Offset(o.Offset).Limit(o.Limit).Find(&rows).Error; x != nil {
		return nil, 0, x
	}
	out := make([]*biz.Keyword, 0, len(rows))
	for j := range rows {
		out = append(out, keywordDO(&rows[j]))
	}
	return out, total, nil
}
func (r *keywordRepo) Update(c context.Context, i *biz.Keyword) (*biz.Keyword, error) {
	u := map[string]any{"brand_id": i.BrandID, "text": i.Text, "region": i.Region, "tags_json": jsonBytes(i.TagsJSON), "priority": i.Priority, "status": i.Status, "version": gorm.Expr("version + 1")}
	res := r.data.DB(c).Model(&model.Keyword{}).Where("enterprise_id = ? AND id = ? AND version = ?", i.EnterpriseID, i.ID, i.Version).Updates(u)
	if res.Error != nil {
		return nil, mapKeywordError(res.Error)
	}
	if res.RowsAffected != 1 {
		return nil, biz.ErrKeywordConflict
	}
	return r.Get(c, i.EnterpriseID, i.ID)
}
func (r *keywordRepo) MarkDistillationFailed(c context.Context, enterpriseID, id uint64, requestedCount uint32, message string) (*biz.Keyword, error) {
	result := r.data.DB(c).Model(&model.Keyword{}).Where("enterprise_id = ? AND id = ?", enterpriseID, id).Updates(map[string]any{
		"requested_question_count": requestedCount,
		"distillation_status":      biz.KeywordDistillationStatusFailed,
		"distillation_error":       message,
		"version":                  gorm.Expr("version + 1"),
	})
	if result.Error != nil {
		return nil, mapKeywordError(result.Error)
	}
	return r.Get(c, enterpriseID, id)
}
func (r *keywordRepo) Delete(c context.Context, e, id, v uint64) error {
	x := r.data.WithinTransaction(c, func(tx *gorm.DB) error {
		// 先查出关键词记录以获取 source（用于确定配额指标）
		var k model.Keyword
		if err := tx.Where("enterprise_id = ? AND id = ? AND version = ?", e, id, v).First(&k).Error; err != nil {
			return err
		}
		// 软删除关键词
		if err := tx.Where("enterprise_id = ? AND id = ? AND version = ?", e, id, v).Delete(&model.Keyword{}).Error; err != nil {
			return err
		}
		// 释放关键词配额（used_value -= 1）
		metric := keywordMetricBySource(k.Source)
		if metric != "" {
			return releaseUsedQuota(tx, e, metric, 1, "keyword", id, fmt.Sprintf("keyword-delete-%d", id))
		}
		return nil
	})
	if x != nil {
		return mapKeywordError(x)
	}
	return nil
}
func keywordPO(i *biz.Keyword) *model.Keyword {
	return &model.Keyword{TenantModel: model.TenantModel{EnterpriseID: i.EnterpriseID}, BrandID: i.BrandID, Text: strings.TrimSpace(i.Text), Region: strings.TrimSpace(i.Region), TagsJSON: jsonBytes(i.TagsJSON), Priority: i.Priority, RequestedQuestionCount: i.RequestedQuestionCount, DistillationStatus: i.DistillationStatus, Status: i.Status, Source: i.Source, Version: 1}
}
func keywordDO(i *model.Keyword) *biz.Keyword {
	lastTaskID := uint64(0)
	if i.LastDistillationTaskID != nil {
		lastTaskID = *i.LastDistillationTaskID
	}
	return &biz.Keyword{ID: i.ID, EnterpriseID: i.EnterpriseID, BrandID: i.BrandID, Text: i.Text, Region: i.Region, TagsJSON: string(i.TagsJSON), Priority: i.Priority, RequestedQuestionCount: i.RequestedQuestionCount, DistilledQuestionCount: i.DistilledQuestionCount, DistillationStatus: i.DistillationStatus, LastDistillationTaskID: lastTaskID, DistillationError: i.DistillationError, Status: i.Status, Source: i.Source, Version: i.Version, CreatedAt: i.CreatedAt, UpdatedAt: i.UpdatedAt}
}
func mapKeywordError(e error) error {
	if stderrors.Is(e, gorm.ErrRecordNotFound) {
		return biz.ErrKeywordNotFound
	}
	if stderrors.Is(e, gorm.ErrDuplicatedKey) {
		return biz.ErrKeywordConflict
	}
	if stderrors.Is(e, biz.ErrPublishQuota) {
		return biz.ErrKeywordQuotaExceeded
	}
	return e
}
