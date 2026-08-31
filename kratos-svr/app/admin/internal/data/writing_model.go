package data

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/cryptobox"
	"kratos-svr/internal/data/model"

	"gorm.io/gorm"
)

type writingModelRepo struct {
	data   *Data
	client *http.Client
}

func NewWritingModelRepo(data *Data) biz.WritingModelRepo {
	return &writingModelRepo{data: data, client: &http.Client{Timeout: 30 * time.Second}}
}

func (r *writingModelRepo) Create(ctx context.Context, item *biz.WritingModel) (*biz.WritingModel, error) {
	var po model.WritingModel
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		// 用 map 代替 struct Create，避免 GORM 对 bool 零值字段跳过写入，
		// 导致使用数据库 default 值（如 SafetyFailClosed default:true 会覆盖用户配置的 false）。
		now := time.Now().UTC()
		creatingFields := map[string]any{
			"code": item.Code, "display_name": item.DisplayName, "provider": item.Provider,
			"protocol": item.Protocol, "base_url": item.BaseURL, "model_id": item.ModelID,
			"context_length": item.ContextLength, "status": item.Status, "sort_order": item.SortOrder,
			"temperature": item.Temperature, "top_p": item.TopP, "max_tokens": item.MaxTokens,
			"timeout_seconds": item.TimeoutSeconds, "citation_capability": item.CitationCapability,
			"safety_enabled":               item.SafetyEnabled,
			"input_moderation_enabled":     item.InputModerationEnabled,
			"output_moderation_enabled":    item.OutputModerationEnabled,
			"safety_fail_closed":           item.SafetyFailClosed,
			"input_price_micros_per_million_tokens":  item.InputPriceMicrosPerMillionTokens,
			"output_price_micros_per_million_tokens": item.OutputPriceMicrosPerMillionTokens,
			"price_currency": item.PriceCurrency, "access_scope": item.AccessScope,
			"version": 1, "created_at": now, "updated_at": now,
		}
		if err := tx.Table(model.TableWritingModels).Create(creatingFields).Error; err != nil {
			return err
		}
		// 查询刚创建的记录的 ID
		if err := tx.Table(model.TableWritingModels).Where("code = ?", item.Code).Select("id").Scan(&po.ID).Error; err != nil {
			return err
		}
		if err := validateWritingModelScopes(tx, item); err != nil {
			return err
		}
		if err := replaceWritingModelConfiguration(tx, po.ID, item); err != nil {
			return err
		}
		credential, err := r.newCredential(po.ID, item.APIKey)
		if err != nil {
			return err
		}
		if err := tx.Create(credential).Error; err != nil {
			return err
		}
		return tx.Model(&po).Update("credential_ref", fmt.Sprintf("writing-model:%d", credential.ID)).Error
	})
	if err != nil {
		return nil, mapWritingModelError(err)
	}
	return r.Get(ctx, po.ID)
}

func (r *writingModelRepo) Get(ctx context.Context, id uint64) (*biz.WritingModel, error) {
	var po model.WritingModel
	if err := r.data.DB(ctx).First(&po, id).Error; err != nil {
		return nil, mapWritingModelError(err)
	}
	item := writingModelDO(&po)
	if err := hydrateWritingModelConfiguration(r.data.DB(ctx), []*biz.WritingModel{item}); err != nil {
		return nil, err
	}
	var count int64
	if err := r.data.DB(ctx).Model(&model.WritingModelCredential{}).Where("writing_model_id = ?", id).Count(&count).Error; err != nil {
		return nil, err
	}
	item.CredentialConfigured = count > 0
	return item, nil
}

func (r *writingModelRepo) List(ctx context.Context, opts biz.WritingModelListOptions) ([]*biz.WritingModel, int64, error) {
	db := r.data.DB(ctx).Model(&model.WritingModel{})
	if opts.Provider != 0 {
		db = db.Where("provider = ?", opts.Provider)
	}
	if opts.Status != 0 {
		db = db.Where("status = ?", opts.Status)
	}
	if opts.Keyword != "" {
		keyword := "%" + opts.Keyword + "%"
		db = db.Where("display_name LIKE ? OR code LIKE ? OR model_id LIKE ?", keyword, keyword, keyword)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, mapWritingModelError(err)
	}
	var records []model.WritingModel
	if err := db.Order("sort_order ASC, id DESC").Offset(opts.Offset).Limit(opts.Limit).Find(&records).Error; err != nil {
		return nil, 0, mapWritingModelError(err)
	}
	items := make([]*biz.WritingModel, 0, len(records))
	for i := range records {
		item := writingModelDO(&records[i])
		item.CredentialConfigured = records[i].CredentialRef != ""
		items = append(items, item)
	}
	if err := hydrateWritingModelConfiguration(r.data.DB(ctx), items); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *writingModelRepo) Update(ctx context.Context, item *biz.WritingModel) (*biz.WritingModel, error) {
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		if err := validateWritingModelScopes(tx, item); err != nil {
			return err
		}
		updates := map[string]any{
			"display_name": item.DisplayName, "provider": item.Provider, "protocol": item.Protocol,
			"base_url": item.BaseURL, "model_id": item.ModelID, "context_length": item.ContextLength,
			"status": item.Status, "sort_order": item.SortOrder, "temperature": item.Temperature,
			"top_p": item.TopP, "max_tokens": item.MaxTokens, "timeout_seconds": item.TimeoutSeconds,
			"citation_capability": item.CitationCapability,
			"diagnosis_api_mode":  item.DiagnosisAPIMode, "diagnosis_web_search_enabled": item.DiagnosisWebSearchEnabled,
			"safety_enabled": item.SafetyEnabled, "input_moderation_enabled": item.InputModerationEnabled,
			"output_moderation_enabled": item.OutputModerationEnabled, "safety_fail_closed": item.SafetyFailClosed,
			"input_price_micros_per_million_tokens":  item.InputPriceMicrosPerMillionTokens,
			"output_price_micros_per_million_tokens": item.OutputPriceMicrosPerMillionTokens,
			"price_currency":                         item.PriceCurrency, "access_scope": item.AccessScope,
			"version": gorm.Expr("version + 1"),
		}
		result := tx.Model(&model.WritingModel{}).Where("id = ? AND version = ?", item.ID, item.Version).Updates(updates)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return biz.ErrWritingModelConflict
		}
		if err := replaceWritingModelConfiguration(tx, item.ID, item); err != nil {
			return err
		}
		if item.APIKey != "" {
			credential, err := r.newCredential(item.ID, item.APIKey)
			if err != nil {
				return err
			}
			var current model.WritingModelCredential
			err = tx.Where("writing_model_id = ?", item.ID).First(&current).Error
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return tx.Create(credential).Error
			}
			if err != nil {
				return err
			}
			return tx.Model(&current).Updates(map[string]any{"key_id": credential.KeyID, "algorithm": credential.Algorithm, "ciphertext": credential.Ciphertext, "nonce": credential.Nonce, "version": gorm.Expr("version + 1")}).Error
		}
		return nil
	})
	if err != nil {
		return nil, mapWritingModelError(err)
	}
	return r.Get(ctx, item.ID)
}

func (r *writingModelRepo) Delete(ctx context.Context, id, version uint64) error {
	return r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		result := tx.Where("id = ? AND version = ?", id, version).Delete(&model.WritingModel{})
		if result.Error != nil {
			return mapWritingModelError(result.Error)
		}
		if result.RowsAffected != 1 {
			return biz.ErrWritingModelConflict
		}
		for _, target := range []any{
			&model.WritingModelPurpose{},
			&model.WritingModelSafetyRule{},
			&model.WritingModelPlanScope{},
			&model.WritingModelEnterpriseScope{},
			&model.EnterpriseModelGrant{},
			&model.WritingModelCredential{},
		} {
			if err := tx.Where("writing_model_id = ?", id).Delete(target).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *writingModelRepo) Test(ctx context.Context, id uint64, prompt string) (*biz.WritingModelTestResult, error) {
	var po model.WritingModel
	if err := r.data.DB(ctx).First(&po, id).Error; err != nil {
		return nil, mapWritingModelError(err)
	}
	var credential model.WritingModelCredential
	if err := r.data.DB(ctx).Where("writing_model_id = ?", id).First(&credential).Error; err != nil {
		return nil, mapWritingModelError(err)
	}
	apiKey, err := r.data.openCredential(credential.Nonce, credential.Ciphertext, []byte(fmt.Sprintf("writing-model:%d", id)))
	if err != nil {
		return nil, err
	}
	defer clear(apiKey)
	if po.DiagnosisAPIMode == model.WritingModelDiagnosisAPIResponses {
		started := time.Now()
		response, callErr := callDiagnosisResponses(ctx, r.client, &biz.SalesDiagnosisModel{
			Provider: po.Provider, Protocol: po.Protocol, BaseURL: po.BaseURL, ModelID: po.ModelID,
			Temperature: po.Temperature, TopP: po.TopP, MaxTokens: po.MaxTokens, TimeoutSeconds: po.TimeoutSeconds,
			DiagnosisAPIMode: po.DiagnosisAPIMode, DiagnosisWebSearchEnabled: po.DiagnosisWebSearchEnabled,
		}, string(apiKey), "你正在执行模型连接与联网能力测试。", prompt)
		latency := uint64(time.Since(started).Milliseconds())
		if callErr != nil {
			return &biz.WritingModelTestResult{LatencyMS: latency, ErrorCode: "RESPONSES_API_ERROR"}, nil
		}
		preview := response.Content
		if len([]rune(preview)) > 500 {
			preview = string([]rune(preview)[:500])
		}
		return &biz.WritingModelTestResult{Success: true, LatencyMS: latency, ResponsePreview: preview}, nil
	}
	payload, err := json.Marshal(map[string]any{"model": po.ModelID, "messages": []map[string]string{{"role": "user", "content": prompt}}, "max_tokens": 64, "temperature": 0})
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(po.BaseURL, "/")+"/chat/completions", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+string(apiKey))
	req.Header.Set("Content-Type", "application/json")
	started := time.Now()
	resp, err := r.client.Do(req)
	latency := uint64(time.Since(started).Milliseconds())
	if err != nil {
		return &biz.WritingModelTestResult{LatencyMS: latency, ErrorCode: "NETWORK_ERROR"}, nil
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return &biz.WritingModelTestResult{LatencyMS: latency, ErrorCode: fmt.Sprintf("HTTP_%d", resp.StatusCode)}, nil
	}
	var decoded struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(body, &decoded); err != nil || len(decoded.Choices) == 0 {
		return &biz.WritingModelTestResult{LatencyMS: latency, ErrorCode: "INVALID_RESPONSE"}, nil
	}
	preview := decoded.Choices[0].Message.Content
	if len([]rune(preview)) > 500 {
		preview = string([]rune(preview)[:500])
	}
	return &biz.WritingModelTestResult{Success: true, LatencyMS: latency, ResponsePreview: preview}, nil
}

func (r *writingModelRepo) newCredential(modelID uint64, apiKey string) (*model.WritingModelCredential, error) {
	aad := []byte(fmt.Sprintf("writing-model:%d", modelID))
	nonce, ciphertext, err := r.data.sealCredential([]byte(apiKey), aad)
	if err != nil {
		return nil, err
	}
	return &model.WritingModelCredential{WritingModelID: modelID, KeyID: "config-v1", Algorithm: cryptobox.Algorithm, Ciphertext: ciphertext, Nonce: nonce, Version: 1}, nil
}

func writingModelPO(item *biz.WritingModel) *model.WritingModel {
	return &model.WritingModel{
		Code: item.Code, DisplayName: item.DisplayName, Provider: item.Provider, Protocol: item.Protocol,
		BaseURL: item.BaseURL, ModelID: item.ModelID, ContextLength: item.ContextLength,
		Status: item.Status, SortOrder: item.SortOrder, Temperature: item.Temperature, TopP: item.TopP,
		MaxTokens: item.MaxTokens, TimeoutSeconds: item.TimeoutSeconds, CitationCapability: item.CitationCapability,
		DiagnosisAPIMode: item.DiagnosisAPIMode, DiagnosisWebSearchEnabled: item.DiagnosisWebSearchEnabled,
		SafetyEnabled:          item.SafetyEnabled,
		InputModerationEnabled: item.InputModerationEnabled, OutputModerationEnabled: item.OutputModerationEnabled,
		SafetyFailClosed: item.SafetyFailClosed, InputPriceMicrosPerMillionTokens: item.InputPriceMicrosPerMillionTokens,
		OutputPriceMicrosPerMillionTokens: item.OutputPriceMicrosPerMillionTokens, PriceCurrency: item.PriceCurrency,
		AccessScope: item.AccessScope, Version: 1,
	}
}
func writingModelDO(po *model.WritingModel) *biz.WritingModel {
	return &biz.WritingModel{
		ID: po.ID, Code: po.Code, DisplayName: po.DisplayName, Provider: po.Provider, Protocol: po.Protocol,
		BaseURL: po.BaseURL, ModelID: po.ModelID, ContextLength: po.ContextLength, Status: po.Status,
		SortOrder: po.SortOrder, Temperature: po.Temperature, TopP: po.TopP, MaxTokens: po.MaxTokens,
		TimeoutSeconds: po.TimeoutSeconds, CitationCapability: po.CitationCapability,
		DiagnosisAPIMode: po.DiagnosisAPIMode, DiagnosisWebSearchEnabled: po.DiagnosisWebSearchEnabled,
		SafetyEnabled:          po.SafetyEnabled,
		InputModerationEnabled: po.InputModerationEnabled, OutputModerationEnabled: po.OutputModerationEnabled,
		SafetyFailClosed: po.SafetyFailClosed, InputPriceMicrosPerMillionTokens: po.InputPriceMicrosPerMillionTokens,
		OutputPriceMicrosPerMillionTokens: po.OutputPriceMicrosPerMillionTokens, PriceCurrency: po.PriceCurrency,
		AccessScope: po.AccessScope, Version: po.Version, CreatedAt: po.CreatedAt, UpdatedAt: po.UpdatedAt,
	}
}

func hydrateWritingModelConfiguration(db *gorm.DB, items []*biz.WritingModel) error {
	if len(items) == 0 {
		return nil
	}
	ids := make([]uint64, 0, len(items))
	byID := make(map[uint64]*biz.WritingModel, len(items))
	for _, item := range items {
		ids = append(ids, item.ID)
		byID[item.ID] = item
	}
	var purposes []model.WritingModelPurpose
	if err := db.Where("writing_model_id IN ?", ids).Order("id ASC").Find(&purposes).Error; err != nil {
		return err
	}
	for _, purpose := range purposes {
		byID[purpose.WritingModelID].Purposes = append(byID[purpose.WritingModelID].Purposes, purpose.Purpose)
	}
	var safetyRules []model.WritingModelSafetyRule
	if err := db.Where("writing_model_id IN ?", ids).Order("id ASC").Find(&safetyRules).Error; err != nil {
		return err
	}
	for _, rule := range safetyRules {
		byID[rule.WritingModelID].BlockedSafetyCategories = append(byID[rule.WritingModelID].BlockedSafetyCategories, rule.Category)
	}
	var planScopes []model.WritingModelPlanScope
	if err := db.Where("writing_model_id IN ?", ids).Order("id ASC").Find(&planScopes).Error; err != nil {
		return err
	}
	for _, scope := range planScopes {
		byID[scope.WritingModelID].VisiblePlanIDs = append(byID[scope.WritingModelID].VisiblePlanIDs, scope.PlanID)
	}
	var enterpriseScopes []model.WritingModelEnterpriseScope
	if err := db.Where("writing_model_id IN ?", ids).Order("id ASC").Find(&enterpriseScopes).Error; err != nil {
		return err
	}
	for _, scope := range enterpriseScopes {
		byID[scope.WritingModelID].VisibleEnterpriseIDs = append(byID[scope.WritingModelID].VisibleEnterpriseIDs, scope.EnterpriseID)
	}
	return nil
}

func validateWritingModelScopes(tx *gorm.DB, item *biz.WritingModel) error {
	if item.AccessScope != biz.WritingModelAccessRestricted {
		return nil
	}
	if len(item.VisiblePlanIDs) == 0 && len(item.VisibleEnterpriseIDs) == 0 {
		return biz.ErrWritingModelInvalid
	}
	if len(item.VisiblePlanIDs) > 0 {
		var count int64
		if err := tx.Model(&model.Plan{}).Where("id IN ?", item.VisiblePlanIDs).Count(&count).Error; err != nil {
			return err
		}
		if count != int64(len(item.VisiblePlanIDs)) {
			return biz.ErrWritingModelInvalid
		}
	}
	if len(item.VisibleEnterpriseIDs) > 0 {
		var count int64
		if err := tx.Model(&model.Enterprise{}).Where("id IN ?", item.VisibleEnterpriseIDs).Count(&count).Error; err != nil {
			return err
		}
		if count != int64(len(item.VisibleEnterpriseIDs)) {
			return biz.ErrWritingModelInvalid
		}
	}
	return nil
}

func replaceWritingModelConfiguration(tx *gorm.DB, writingModelID uint64, item *biz.WritingModel) error {
	for _, target := range []any{
		&model.WritingModelPurpose{},
		&model.WritingModelSafetyRule{},
		&model.WritingModelPlanScope{},
		&model.WritingModelEnterpriseScope{},
	} {
		if err := tx.Where("writing_model_id = ?", writingModelID).Delete(target).Error; err != nil {
			return err
		}
	}
	for _, purpose := range item.Purposes {
		if err := tx.Create(&model.WritingModelPurpose{WritingModelID: writingModelID, Purpose: purpose}).Error; err != nil {
			return err
		}
	}
	for _, category := range item.BlockedSafetyCategories {
		if err := tx.Create(&model.WritingModelSafetyRule{WritingModelID: writingModelID, Category: category}).Error; err != nil {
			return err
		}
	}
	for _, planID := range item.VisiblePlanIDs {
		if err := tx.Create(&model.WritingModelPlanScope{WritingModelID: writingModelID, PlanID: planID}).Error; err != nil {
			return err
		}
	}
	for _, enterpriseID := range item.VisibleEnterpriseIDs {
		if err := tx.Create(&model.WritingModelEnterpriseScope{WritingModelID: writingModelID, EnterpriseID: enterpriseID}).Error; err != nil {
			return err
		}
	}
	return nil
}
func mapWritingModelError(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return biz.ErrWritingModelNotFound
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return biz.ErrWritingModelConflict
	}
	return err
}
