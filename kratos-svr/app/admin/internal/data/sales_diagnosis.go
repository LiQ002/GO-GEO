package data

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/data/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type salesDiagnosisRepo struct{ data *Data }

type diagnosisMetricDatum struct {
	ResultID          uint64
	Mentioned         float64
	TargetMentions    float64
	AllBrandMentions  float64
	RankEligible      float64
	Top3              float64
	ClaimsMatched     float64
	ClaimsTotal       float64
	CitationEligible  float64
	Cited             float64
	Positive          float64
	Neutral           float64
	Negative          float64
	SentimentEligible float64
	AnalysisSucceeded bool
}

func NewSalesDiagnosisRepo(data *Data) biz.SalesDiagnosisRepo {
	return &salesDiagnosisRepo{data: data}
}

func (r *salesDiagnosisRepo) Create(ctx context.Context, cmd biz.CreateSalesDiagnosisCommand) (*biz.SalesDiagnosis, error) {
	var diagnosisID uint64
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		profile, aliases, products, competitors, err := diagnosisProfileSnapshot(tx, cmd)
		if err != nil {
			return err
		}
		questionsInput := cmd.Questions
		automaticPreparation := len(questionsInput) == 0
		modelSnapshots, err := diagnosisModelSnapshots(tx, cmd.WritingModelIDs)
		if err != nil {
			return err
		}
		if len(modelSnapshots) == 0 {
			return biz.ErrSalesDiagnosisInvalid
		}
		diagnosis := &model.SalesDiagnosis{
			Code: cmd.Code, Name: cmd.Name, SubjectType: cmd.SubjectType,
			CreatedByAdminID: cmd.OperatorID, Status: model.SalesDiagnosisStatusPending,
			QuestionCount: uint32(len(questionsInput)), ModelCount: uint32(len(modelSnapshots)),
			TaskCount: uint32(len(questionsInput) * len(modelSnapshots)), Version: 1,
		}
		if cmd.OpportunityID != 0 {
			diagnosis.OpportunityID = &cmd.OpportunityID
		}
		if cmd.EnterpriseID != 0 {
			diagnosis.EnterpriseID = &cmd.EnterpriseID
		}
		if err := tx.Create(diagnosis).Error; err != nil {
			return err
		}
		diagnosisID = diagnosis.ID
		profile.DiagnosisID = diagnosis.ID
		if err := tx.Create(profile).Error; err != nil {
			return err
		}
		for i := range aliases {
			aliases[i].DiagnosisID = diagnosis.ID
		}
		for i := range products {
			products[i].DiagnosisID = diagnosis.ID
		}
		for i := range competitors {
			competitors[i].DiagnosisID = diagnosis.ID
		}
		if len(aliases) > 0 {
			if err := tx.Create(&aliases).Error; err != nil {
				return err
			}
		}
		if len(products) > 0 {
			if err := tx.Create(&products).Error; err != nil {
				return err
			}
		}
		if len(competitors) > 0 {
			if err := tx.Create(&competitors).Error; err != nil {
				return err
			}
		}
		claims := diagnosisProfileClaims(diagnosis.ID, profile, products)
		if len(claims) > 0 {
			if err := tx.Create(&claims).Error; err != nil {
				return err
			}
		}
		questions := make([]model.SalesDiagnosisQuestion, 0, len(questionsInput))
		for i, question := range questionsInput {
			questions = append(questions, model.SalesDiagnosisQuestion{
				DiagnosisID: diagnosis.ID, Question: question,
				SourceType: model.SalesDiagnosisQuestionSourceManual, SortOrder: int32(i),
			})
		}
		if len(questions) > 0 {
			if err := tx.Create(&questions).Error; err != nil {
				return err
			}
		}
		for i := range modelSnapshots {
			modelSnapshots[i].DiagnosisID = diagnosis.ID
			modelSnapshots[i].SortOrder = int32(i)
		}
		if err := tx.Create(&modelSnapshots).Error; err != nil {
			return err
		}
		preparationStatus := model.SalesDiagnosisPreparationStatusSkipped
		var preparationModelID *uint64
		if automaticPreparation {
			preparationStatus = model.SalesDiagnosisPreparationStatusPending
			selected := selectDiagnosisPreparationModel(modelSnapshots)
			preparationModelID = &selected.ID
		}
		if err := tx.Create(&model.SalesDiagnosisPreparation{
			DiagnosisID: diagnosis.ID, DiagnosisModelID: preparationModelID,
			Status: preparationStatus, AvailableAt: time.Now().UTC(),
		}).Error; err != nil {
			return err
		}
		tasks := make([]model.SalesDiagnosisTask, 0, len(questions)*len(modelSnapshots))
		availableAt := time.Now().UTC()
		for _, question := range questions {
			for _, diagnosisModel := range modelSnapshots {
				tasks = append(tasks, model.SalesDiagnosisTask{
					DiagnosisID: diagnosis.ID, QuestionID: question.ID, DiagnosisModelID: diagnosisModel.ID,
					Status: model.SalesDiagnosisTaskStatusPending, AvailableAt: availableAt,
				})
			}
		}
		if len(tasks) > 0 {
			if err := tx.Create(&tasks).Error; err != nil {
				return err
			}
		}
		return writeAdminAudit(ctx, tx, cmd.OperatorID, "sales_diagnosis.create", "sales_diagnosis", strconv.FormatUint(diagnosis.ID, 10), "success", "", nil, diagnosis)
	})
	if err != nil {
		return nil, mapSalesDiagnosisError(err)
	}
	return r.Get(ctx, diagnosisID, cmd.Access)
}

func selectDiagnosisPreparationModel(models []model.SalesDiagnosisModel) model.SalesDiagnosisModel {
	for _, item := range models {
		if item.CitationCapability == model.SalesDiagnosisCitationCapabilityProviderSources {
			return item
		}
	}
	return models[0]
}

func (r *salesDiagnosisRepo) Get(ctx context.Context, id uint64, access biz.SalesOpportunityAccess) (*biz.SalesDiagnosis, error) {
	var record model.SalesDiagnosis
	if err := scopeSalesDiagnosisQuery(r.data.DB(ctx).Model(&model.SalesDiagnosis{}), access).First(&record, id).Error; err != nil {
		return nil, mapSalesDiagnosisError(err)
	}
	items, err := r.hydrate(ctx, []model.SalesDiagnosis{record})
	if err != nil {
		return nil, err
	}
	return items[0], nil
}

func (r *salesDiagnosisRepo) List(ctx context.Context, opts biz.SalesDiagnosisListOptions, access biz.SalesOpportunityAccess) ([]*biz.SalesDiagnosis, int64, error) {
	db := scopeSalesDiagnosisQuery(r.data.DB(ctx).Model(&model.SalesDiagnosis{}), access)
	if opts.Keyword != "" {
		like := "%" + opts.Keyword + "%"
		db = db.Where("code LIKE ? OR name LIKE ? OR EXISTS (SELECT 1 FROM sls_diagnosis_profiles p WHERE p.diagnosis_id = sls_diagnoses.id AND (p.customer_name LIKE ? OR p.brand_name LIKE ?))", like, like, like, like)
	}
	if opts.Status != 0 {
		db = db.Where("status = ?", opts.Status)
	}
	if opts.SubjectType != 0 {
		db = db.Where("subject_type = ?", opts.SubjectType)
	}
	if opts.OpportunityID != 0 {
		db = db.Where("opportunity_id = ?", opts.OpportunityID)
	}
	if opts.EnterpriseID != 0 {
		db = db.Where("enterprise_id = ?", opts.EnterpriseID)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, mapSalesDiagnosisError(err)
	}
	var records []model.SalesDiagnosis
	if err := db.Order("created_at DESC, id DESC").Offset(opts.Offset).Limit(opts.Limit).Find(&records).Error; err != nil {
		return nil, 0, mapSalesDiagnosisError(err)
	}
	items, err := r.hydrate(ctx, records)
	return items, total, err
}

func (r *salesDiagnosisRepo) Enqueue(ctx context.Context, id, version uint64, access biz.SalesOpportunityAccess) error {
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var diagnosis model.SalesDiagnosis
		if err := scopeSalesDiagnosisQuery(tx.Model(&model.SalesDiagnosis{}), access).First(&diagnosis, id).Error; err != nil {
			return err
		}
		if diagnosis.Version != version || diagnosis.Status == model.SalesDiagnosisStatusRunning || diagnosis.Status == model.SalesDiagnosisStatusCancelled || diagnosis.Status == model.SalesDiagnosisStatusSucceeded {
			return biz.ErrSalesDiagnosisConflict
		}
		var taskCount int64
		if err := tx.Model(&model.SalesDiagnosisTask{}).Where("diagnosis_id = ? AND status IN ?", id, []int32{model.SalesDiagnosisTaskStatusPending, model.SalesDiagnosisTaskStatusFailed}).Count(&taskCount).Error; err != nil {
			return err
		}
		var preparationCount int64
		if err := tx.Model(&model.SalesDiagnosisPreparation{}).
			Where("diagnosis_id = ? AND status IN ?", id, []int32{model.SalesDiagnosisPreparationStatusPending, model.SalesDiagnosisPreparationStatusFailed}).
			Count(&preparationCount).Error; err != nil {
			return err
		}
		if taskCount == 0 && preparationCount == 0 {
			return biz.ErrSalesDiagnosisConflict
		}
		now := time.Now().UTC()
		if err := tx.Where("diagnosis_id = ?", id).Delete(&model.SalesDiagnosisReport{}).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.SalesDiagnosisTask{}).
			Where("diagnosis_id = ? AND status IN ?", id, []int32{model.SalesDiagnosisTaskStatusPending, model.SalesDiagnosisTaskStatusFailed}).
			Updates(map[string]any{
				"status": model.SalesDiagnosisTaskStatusPending, "available_at": now, "completed_at": nil,
				"lease_owner": "", "lease_token": "", "lease_expires_at": nil,
			}).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.SalesDiagnosisPreparation{}).
			Where("diagnosis_id = ? AND status IN ?", id, []int32{model.SalesDiagnosisPreparationStatusPending, model.SalesDiagnosisPreparationStatusFailed}).
			Updates(map[string]any{
				"status": model.SalesDiagnosisPreparationStatusPending, "available_at": now, "completed_at": nil,
				"lease_owner": "", "lease_token": "", "lease_expires_at": nil,
			}).Error; err != nil {
			return err
		}
		updates := map[string]any{"status": model.SalesDiagnosisStatusRunning, "completed_at": nil, "version": gorm.Expr("version + 1")}
		if diagnosis.StartedAt == nil {
			updates["started_at"] = now
		}
		return tx.Model(&model.SalesDiagnosis{}).Where("id = ? AND version = ?", id, version).Updates(updates).Error
	})
	if err != nil {
		return mapSalesDiagnosisError(err)
	}
	return nil
}

func (r *salesDiagnosisRepo) ClaimNextPreparation(ctx context.Context, workerID string, now time.Time, leaseDuration time.Duration) (*biz.SalesDiagnosisPreparationTask, error) {
	leaseToken, err := newDiagnosisLeaseToken()
	if err != nil {
		return nil, fmt.Errorf("create diagnosis preparation lease token: %w", err)
	}
	var preparationID uint64
	err = r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var candidate struct {
			ID             uint64
			TimeoutSeconds uint32
		}
		if err := tx.Raw(`
			SELECT p.id, m.timeout_seconds
			FROM sls_diagnosis_preparations p
			JOIN sls_diagnoses d ON d.id = p.diagnosis_id AND d.status = ?
			JOIN sls_diagnosis_models m ON m.id = p.diagnosis_model_id
			WHERE (p.status = ? AND p.available_at <= ?)
			   OR (p.status = ? AND p.lease_expires_at IS NOT NULL AND p.lease_expires_at <= ?)
			ORDER BY p.available_at, p.id
			LIMIT 1
			FOR UPDATE SKIP LOCKED`,
			model.SalesDiagnosisStatusRunning,
			model.SalesDiagnosisPreparationStatusPending, now,
			model.SalesDiagnosisPreparationStatusRunning, now,
		).Scan(&candidate).Error; err != nil {
			return err
		}
		if candidate.ID == 0 {
			return nil
		}
		modelLease := time.Duration(candidate.TimeoutSeconds)*time.Second + 30*time.Second
		if modelLease > leaseDuration {
			leaseDuration = modelLease
		}
		leaseExpiresAt := now.Add(leaseDuration)
		updated := tx.Model(&model.SalesDiagnosisPreparation{}).
			Where("id = ? AND ((status = ? AND available_at <= ?) OR (status = ? AND lease_expires_at <= ?))",
				candidate.ID, model.SalesDiagnosisPreparationStatusPending, now,
				model.SalesDiagnosisPreparationStatusRunning, now).
			Updates(map[string]any{
				"status":        model.SalesDiagnosisPreparationStatusRunning,
				"attempt_count": gorm.Expr("attempt_count + 1"),
				"started_at":    now, "completed_at": nil, "last_error_code": "", "last_error_message": "",
				"lease_owner": workerID, "lease_token": leaseToken, "lease_expires_at": leaseExpiresAt,
			})
		if updated.Error != nil {
			return updated.Error
		}
		if updated.RowsAffected != 1 {
			return biz.ErrSalesDiagnosisConflict
		}
		preparationID = candidate.ID
		return nil
	})
	if err != nil {
		return nil, mapSalesDiagnosisError(err)
	}
	if preparationID == 0 {
		return nil, nil
	}
	var preparation model.SalesDiagnosisPreparation
	if err := r.data.DB(ctx).First(&preparation, preparationID).Error; err != nil {
		return nil, mapSalesDiagnosisError(err)
	}
	diagnosis, err := r.Get(ctx, preparation.DiagnosisID, biz.SalesOpportunityAccess{AdminUserID: 1, DataScope: biz.AdminRoleDataScopeAll})
	if err != nil {
		return nil, err
	}
	modelID := uint64(0)
	if preparation.DiagnosisModelID != nil {
		modelID = *preparation.DiagnosisModelID
	}
	var diagnosisModel *biz.SalesDiagnosisModel
	for _, item := range diagnosis.Models {
		if item.ID == modelID {
			diagnosisModel = item
			break
		}
	}
	if diagnosisModel == nil {
		return nil, biz.ErrSalesDiagnosisInvalid
	}
	return &biz.SalesDiagnosisPreparationTask{
		DiagnosisID: diagnosis.ID, PreparationID: preparation.ID,
		AttemptNo: preparation.AttemptCount, LeaseToken: leaseToken,
		Profile: diagnosis.Profile, Model: diagnosisModel,
	}, nil
}

func (r *salesDiagnosisRepo) RecordPreparation(ctx context.Context, result *biz.SalesDiagnosisPreparationResult) error {
	if result == nil || result.PreparationID == 0 || result.AttemptNo == 0 || strings.TrimSpace(result.LeaseToken) == "" {
		return biz.ErrSalesDiagnosisInvalid
	}
	return r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var preparation model.SalesDiagnosisPreparation
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&preparation, result.PreparationID).Error; err != nil {
			return mapSalesDiagnosisError(err)
		}
		if preparation.Status != model.SalesDiagnosisPreparationStatusRunning ||
			preparation.AttemptCount != result.AttemptNo || preparation.LeaseToken != result.LeaseToken {
			return biz.ErrSalesDiagnosisConflict
		}
		attempt := &model.SalesDiagnosisPreparationAttempt{
			PreparationID: preparation.ID, AttemptNo: result.AttemptNo, Succeeded: result.Succeeded,
			Industry: truncateDiagnosisText(result.Industry, 128), BrandSummary: truncateDiagnosisText(result.BrandSummary, 2000),
			PromptSnapshot: result.PromptSnapshot, RawResponseJSON: jsonBytes(result.RawResponseJSON),
			ProviderRequestID: result.ProviderRequestID, ResponseModel: result.ResponseModel,
			InputTokens: result.InputTokens, OutputTokens: result.OutputTokens,
			CostMicros: result.CostMicros, DurationMS: result.DurationMS,
			ErrorCode: result.ErrorCode, ErrorMessage: truncateDiagnosisError(result.ErrorMessage),
		}
		if err := tx.Create(attempt).Error; err != nil {
			return mapSalesDiagnosisError(err)
		}
		now := time.Now().UTC()
		if !result.Succeeded {
			if err := tx.Model(&preparation).Updates(map[string]any{
				"status": model.SalesDiagnosisPreparationStatusFailed, "completed_at": now,
				"last_error_code": attempt.ErrorCode, "last_error_message": attempt.ErrorMessage,
				"lease_owner": "", "lease_token": "", "lease_expires_at": nil,
			}).Error; err != nil {
				return err
			}
			return tx.Model(&model.SalesDiagnosis{}).Where("id = ?", preparation.DiagnosisID).Updates(map[string]any{
				"status": model.SalesDiagnosisStatusFailed, "completed_at": now, "version": gorm.Expr("version + 1"),
			}).Error
		}
		if len(result.Questions) == 0 || len(result.Questions) > 50 || len(result.BrandTerms) == 0 {
			return biz.ErrSalesDiagnosisInvalid
		}
		terms := make([]model.SalesDiagnosisBrandTerm, 0, len(result.BrandTerms))
		for i, item := range result.BrandTerms {
			if item == nil || strings.TrimSpace(item.Term) == "" {
				continue
			}
			terms = append(terms, model.SalesDiagnosisBrandTerm{
				DiagnosisID: preparation.DiagnosisID, Term: truncateDiagnosisText(item.Term, 255),
				TermType: item.TermType, Reason: truncateDiagnosisText(item.Reason, 512), SortOrder: int32(i),
			})
		}
		if len(terms) == 0 {
			return biz.ErrSalesDiagnosisInvalid
		}
		if err := tx.Create(&terms).Error; err != nil {
			return err
		}
		questions := make([]model.SalesDiagnosisQuestion, 0, len(result.Questions))
		for i, item := range result.Questions {
			if item == nil || strings.TrimSpace(item.Question) == "" {
				continue
			}
			questions = append(questions, model.SalesDiagnosisQuestion{
				DiagnosisID: preparation.DiagnosisID, Question: item.Question,
				SourceType: model.SalesDiagnosisQuestionSourceModelGenerated,
				Intent:     truncateDiagnosisText(item.Intent, 128), Reason: truncateDiagnosisText(item.Reason, 512), SortOrder: int32(i),
			})
		}
		if len(questions) == 0 {
			return biz.ErrSalesDiagnosisInvalid
		}
		if err := tx.Create(&questions).Error; err != nil {
			return err
		}
		var diagnosisModels []model.SalesDiagnosisModel
		if err := tx.Where("diagnosis_id = ?", preparation.DiagnosisID).Order("sort_order, id").Find(&diagnosisModels).Error; err != nil {
			return err
		}
		tasks := make([]model.SalesDiagnosisTask, 0, len(questions)*len(diagnosisModels))
		for _, question := range questions {
			for _, diagnosisModel := range diagnosisModels {
				tasks = append(tasks, model.SalesDiagnosisTask{
					DiagnosisID: preparation.DiagnosisID, QuestionID: question.ID, DiagnosisModelID: diagnosisModel.ID,
					Status: model.SalesDiagnosisTaskStatusPending, AvailableAt: now,
				})
			}
		}
		if err := tx.Create(&tasks).Error; err != nil {
			return err
		}
		if err := tx.Model(&preparation).Updates(map[string]any{
			"status": model.SalesDiagnosisPreparationStatusSucceeded, "completed_at": now,
			"last_error_code": "", "last_error_message": "",
			"lease_owner": "", "lease_token": "", "lease_expires_at": nil,
		}).Error; err != nil {
			return err
		}
		return tx.Model(&model.SalesDiagnosis{}).Where("id = ?", preparation.DiagnosisID).Updates(map[string]any{
			"question_count": len(questions), "task_count": len(tasks),
			"status": model.SalesDiagnosisStatusRunning, "completed_at": nil,
			"version": gorm.Expr("version + 1"),
		}).Error
	})
}

func (r *salesDiagnosisRepo) ClaimNext(ctx context.Context, workerID string, now time.Time, leaseDuration time.Duration) (*biz.SalesDiagnosisRunTask, error) {
	leaseToken, err := newDiagnosisLeaseToken()
	if err != nil {
		return nil, fmt.Errorf("create diagnosis lease token: %w", err)
	}
	var taskID uint64
	err = r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var candidate struct {
			ID             uint64
			TimeoutSeconds uint32
		}
		query := `
			SELECT t.id, m.timeout_seconds
			FROM sls_diagnosis_tasks t
			JOIN sls_diagnoses d ON d.id = t.diagnosis_id AND d.status = ?
			JOIN sls_diagnosis_models m ON m.id = t.diagnosis_model_id
			WHERE (t.status = ? AND t.available_at <= ?)
			   OR (t.status = ? AND t.lease_expires_at IS NOT NULL AND t.lease_expires_at <= ?)
			ORDER BY t.available_at, t.id
			LIMIT 1
			FOR UPDATE SKIP LOCKED`
		if err := tx.Raw(query, model.SalesDiagnosisStatusRunning, model.SalesDiagnosisTaskStatusPending, now, model.SalesDiagnosisTaskStatusRunning, now).Scan(&candidate).Error; err != nil {
			return err
		}
		if candidate.ID == 0 {
			return nil
		}
		modelLease := time.Duration(candidate.TimeoutSeconds)*time.Second + 30*time.Second
		if modelLease > leaseDuration {
			leaseDuration = modelLease
		}
		leaseExpiresAt := now.Add(leaseDuration)
		result := tx.Model(&model.SalesDiagnosisTask{}).
			Where("id = ? AND ((status = ? AND available_at <= ?) OR (status = ? AND lease_expires_at <= ?))", candidate.ID, model.SalesDiagnosisTaskStatusPending, now, model.SalesDiagnosisTaskStatusRunning, now).
			Updates(map[string]any{
				"status": model.SalesDiagnosisTaskStatusRunning, "attempt_count": gorm.Expr("attempt_count + 1"),
				"started_at": now, "completed_at": nil, "last_error_code": "", "last_error_message": "",
				"lease_owner": workerID, "lease_token": leaseToken, "lease_expires_at": leaseExpiresAt,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return biz.ErrSalesDiagnosisConflict
		}
		taskID = candidate.ID
		return nil
	})
	if err != nil {
		return nil, mapSalesDiagnosisError(err)
	}
	if taskID == 0 {
		return nil, nil
	}
	tasks, err := r.loadRunTasks(ctx, 0, taskID)
	if err != nil {
		return nil, err
	}
	if len(tasks) != 1 {
		return nil, biz.ErrSalesDiagnosisNotFound
	}
	tasks[0].LeaseToken = leaseToken
	return tasks[0], nil
}

func (r *salesDiagnosisRepo) RecordResult(ctx context.Context, result *biz.SalesDiagnosisResult) error {
	if result == nil {
		return biz.ErrSalesDiagnosisInvalid
	}
	return r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		po := &model.SalesDiagnosisResult{
			TaskID: result.TaskID, AttemptNo: result.AttemptNo, Succeeded: result.Succeeded,
			Answer: result.Answer, RawResponseJSON: jsonBytes(result.RawResponseJSON), ProviderRequestID: result.ProviderRequestID,
			ResponseModel: result.ResponseModel, PromptSnapshot: result.PromptSnapshot, EvidenceType: result.EvidenceType,
			InputTokens: result.InputTokens, OutputTokens: result.OutputTokens, CostMicros: result.CostMicros,
			DurationMS: result.DurationMS, BrandMentioned: result.BrandMentioned, BrandPosition: result.BrandPosition,
			ErrorCode: result.ErrorCode, ErrorMessage: truncateDiagnosisError(result.ErrorMessage),
		}
		if po.EvidenceType == 0 {
			po.EvidenceType = model.SalesDiagnosisEvidenceModelKnowledge
		}
		if err := tx.Create(po).Error; err != nil {
			return mapSalesDiagnosisError(err)
		}
		citations := make([]model.SalesDiagnosisCitation, 0, len(result.Citations))
		for i, citation := range result.Citations {
			if citation == nil || strings.TrimSpace(citation.URL) == "" {
				continue
			}
			ownershipType := citation.OwnershipType
			if ownershipType == 0 {
				ownershipType = 1
			}
			verificationStatus := citation.VerificationStatus
			if verificationStatus == 0 {
				verificationStatus = 1
			}
			sourceType := citation.SourceType
			if sourceType == 0 {
				sourceType = model.SalesDiagnosisSourceOther
			}
			citations = append(citations, model.SalesDiagnosisCitation{
				ResultID: po.ID, ProviderSourceID: citation.ProviderSourceID, SourceName: citation.SourceName,
				Title: citation.Title, URL: citation.URL, Domain: citation.Domain, Snippet: citation.Snippet,
				Position: citation.Position, OwnershipType: ownershipType, SourceType: sourceType,
				VerificationStatus: verificationStatus, CapturedAt: citation.CapturedAt, SortOrder: int32(i),
			})
		}
		if len(citations) > 0 {
			if err := tx.Create(&citations).Error; err != nil {
				return err
			}
		}
		mentions := make([]model.SalesDiagnosisCompetitorMention, 0, len(result.CompetitorMentions))
		for _, mention := range result.CompetitorMentions {
			if mention == nil || strings.TrimSpace(mention.CompetitorName) == "" {
				continue
			}
			mentions = append(mentions, model.SalesDiagnosisCompetitorMention{
				ResultID: po.ID, CompetitorName: mention.CompetitorName, Position: mention.Position,
			})
		}
		if len(mentions) > 0 {
			if err := tx.Create(&mentions).Error; err != nil {
				return err
			}
		}
		if result.Analysis != nil {
			analysis := &model.SalesDiagnosisResultAnalysis{
				ResultID: po.ID, AnalysisVersion: result.Analysis.AnalysisVersion, RuleVersion: result.Analysis.RuleVersion,
				AnalyzerKind: result.Analysis.AnalyzerKind, AnalyzerModelName: result.Analysis.AnalyzerModelName,
				PromptSnapshot: result.Analysis.PromptSnapshot, RawResponseJSON: jsonBytes(result.Analysis.RawResponseJSON),
				Status: result.Analysis.Status, DominantSentiment: result.Analysis.DominantSentiment,
				Confidence: result.Analysis.Confidence, Included: result.Analysis.Included,
				CompletenessScore: result.Analysis.CompletenessScore, AnswerQualityScore: result.Analysis.AnswerQualityScore,
				FreshnessScore: result.Analysis.FreshnessScore, FreshnessAvailable: result.Analysis.FreshnessAvailable,
				RecommendationPosition: result.Analysis.RecommendationPosition, AnswerSummary: result.Analysis.AnswerSummary,
				Strengths: result.Analysis.Strengths, Gaps: result.Analysis.Gaps,
				ErrorMessage: truncateDiagnosisError(result.Analysis.ErrorMessage),
			}
			if err := tx.Create(analysis).Error; err != nil {
				return err
			}
			entities := make([]model.SalesDiagnosisEntityMention, 0, len(result.Analysis.EntityMentions))
			for _, entity := range result.Analysis.EntityMentions {
				if entity == nil || strings.TrimSpace(entity.EntityName) == "" {
					continue
				}
				var entityRefID *uint64
				if entity.EntityRefID != 0 {
					value := entity.EntityRefID
					entityRefID = &value
				}
				entities = append(entities, model.SalesDiagnosisEntityMention{
					AnalysisID: analysis.ID, EntityType: entity.EntityType, EntityRefID: entityRefID,
					EntityName: entity.EntityName, MentionCount: entity.MentionCount,
					FirstPosition: entity.FirstPosition, RankPosition: entity.RankPosition,
					Sentiment: entity.Sentiment, Confidence: entity.Confidence, EvidenceExcerpt: entity.EvidenceExcerpt,
				})
			}
			if len(entities) > 0 {
				if err := tx.Create(&entities).Error; err != nil {
					return err
				}
			}
			matches := make([]model.SalesDiagnosisClaimMatch, 0, len(result.Analysis.ClaimMatches))
			for _, match := range result.Analysis.ClaimMatches {
				if match == nil || match.ClaimID == 0 {
					continue
				}
				matches = append(matches, model.SalesDiagnosisClaimMatch{
					AnalysisID: analysis.ID, ClaimID: match.ClaimID, Matched: match.Matched,
					Confidence: match.Confidence, EvidenceExcerpt: match.EvidenceExcerpt,
				})
			}
			if len(matches) > 0 {
				if err := tx.Create(&matches).Error; err != nil {
					return err
				}
			}
		}
		status := model.SalesDiagnosisTaskStatusFailed
		completedAt := time.Now().UTC()
		updates := map[string]any{
			"status": status, "completed_at": completedAt, "last_error_code": po.ErrorCode,
			"last_error_message": po.ErrorMessage,
		}
		if po.Succeeded {
			updates["status"] = model.SalesDiagnosisTaskStatusSucceeded
			updates["last_error_code"] = ""
			updates["last_error_message"] = ""
		}
		updates["lease_owner"] = ""
		updates["lease_token"] = ""
		updates["lease_expires_at"] = nil
		updated := tx.Model(&model.SalesDiagnosisTask{}).
			Where("id = ? AND status = ? AND attempt_count = ? AND lease_token = ?", result.TaskID, model.SalesDiagnosisTaskStatusRunning, result.AttemptNo, result.LeaseToken).
			Updates(updates)
		if updated.Error != nil {
			return updated.Error
		}
		if updated.RowsAffected != 1 {
			return biz.ErrSalesDiagnosisConflict
		}
		return nil
	})
}

func (r *salesDiagnosisRepo) FindPendingFinalization(ctx context.Context) (uint64, error) {
	var candidate struct{ ID uint64 }
	err := r.data.DB(ctx).Raw(`
		SELECT d.id
		FROM sls_diagnoses d
		WHERE d.task_count > 0
		  AND d.status <> ?
		  AND NOT EXISTS (
		    SELECT 1
		    FROM sls_diagnosis_tasks t
		    WHERE t.diagnosis_id = d.id
		      AND t.status NOT IN (?, ?)
		  )
		  AND (
		    d.status NOT IN (?, ?, ?)
		    OR d.completed_at IS NULL
		    OR d.succeeded_task_count <> (
		      SELECT COUNT(*) FROM sls_diagnosis_tasks t
		      WHERE t.diagnosis_id = d.id AND t.status = ?
		    )
		    OR d.failed_task_count <> (
		      SELECT COUNT(*) FROM sls_diagnosis_tasks t
		      WHERE t.diagnosis_id = d.id AND t.status = ?
		    )
		    OR (
		      SELECT COUNT(*) FROM sls_diagnosis_reports report
		      WHERE report.diagnosis_id = d.id AND report.is_current = TRUE
		    ) <> 1
		  )
		ORDER BY d.updated_at, d.id
		LIMIT 1`,
		model.SalesDiagnosisStatusCancelled,
		model.SalesDiagnosisTaskStatusSucceeded, model.SalesDiagnosisTaskStatusFailed,
		model.SalesDiagnosisStatusSucceeded, model.SalesDiagnosisStatusPartiallySucceeded, model.SalesDiagnosisStatusFailed,
		model.SalesDiagnosisTaskStatusSucceeded, model.SalesDiagnosisTaskStatusFailed,
	).Scan(&candidate).Error
	if err != nil {
		return 0, mapSalesDiagnosisError(err)
	}
	return candidate.ID, nil
}

func (r *salesDiagnosisRepo) Finalize(ctx context.Context, id uint64) error {
	return r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var diagnosis model.SalesDiagnosis
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&diagnosis, id).Error; err != nil {
			return mapSalesDiagnosisError(err)
		}
		if diagnosis.Status == model.SalesDiagnosisStatusCancelled {
			return nil
		}
		var counts []struct {
			Status int32
			Count  int64
		}
		if err := tx.Model(&model.SalesDiagnosisTask{}).Select("status, COUNT(*) AS count").Where("diagnosis_id = ?", id).Group("status").Scan(&counts).Error; err != nil {
			return err
		}
		var succeeded, failed, unfinished int64
		for _, count := range counts {
			switch count.Status {
			case model.SalesDiagnosisTaskStatusSucceeded:
				succeeded += count.Count
			case model.SalesDiagnosisTaskStatusFailed:
				failed += count.Count
			default:
				unfinished += count.Count
			}
		}
		status := model.SalesDiagnosisStatusRunning
		var completedAt *time.Time
		if unfinished == 0 {
			now := time.Now().UTC()
			completedAt = &now
			switch {
			case succeeded == int64(diagnosis.TaskCount):
				status = model.SalesDiagnosisStatusSucceeded
			case succeeded > 0:
				status = model.SalesDiagnosisStatusPartiallySucceeded
			default:
				status = model.SalesDiagnosisStatusFailed
			}
		}
		var currentReportCount int64
		if unfinished == 0 {
			if err := tx.Model(&model.SalesDiagnosisReport{}).
				Where("diagnosis_id = ? AND is_current = TRUE", id).
				Count(&currentReportCount).Error; err != nil {
				return err
			}
		}
		countsMatch := diagnosis.SucceededTaskCount == uint32(succeeded) && diagnosis.FailedTaskCount == uint32(failed)
		if unfinished == 0 && countsMatch && diagnosis.Status == status && diagnosis.CompletedAt != nil && currentReportCount == 1 {
			return nil
		}
		if unfinished > 0 && countsMatch && diagnosis.Status == model.SalesDiagnosisStatusRunning && diagnosis.CompletedAt == nil {
			return nil
		}
		if err := tx.Model(&model.SalesDiagnosis{}).Where("id = ?", id).Updates(map[string]any{
			"status": status, "succeeded_task_count": succeeded, "failed_task_count": failed,
			"completed_at": completedAt, "version": gorm.Expr("version + 1"),
		}).Error; err != nil {
			return err
		}
		if err := replaceSalesDiagnosisMetrics(tx, id); err != nil {
			return err
		}
		if unfinished == 0 {
			return replaceSalesDiagnosisReport(tx, &diagnosis, status, succeeded, failed)
		}
		return nil
	})
}

func (r *salesDiagnosisRepo) Cancel(ctx context.Context, cmd biz.SalesDiagnosisCancelCommand) error {
	return r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var diagnosis model.SalesDiagnosis
		if err := scopeSalesDiagnosisQuery(tx.Model(&model.SalesDiagnosis{}), cmd.Access).First(&diagnosis, cmd.ID).Error; err != nil {
			return mapSalesDiagnosisError(err)
		}
		if diagnosis.Version != cmd.Version || diagnosis.Status == model.SalesDiagnosisStatusSucceeded || diagnosis.Status == model.SalesDiagnosisStatusCancelled {
			return biz.ErrSalesDiagnosisConflict
		}
		now := time.Now().UTC()
		result := tx.Model(&model.SalesDiagnosis{}).Where("id = ? AND version = ?", cmd.ID, cmd.Version).Updates(map[string]any{
			"status": model.SalesDiagnosisStatusCancelled, "completed_at": now, "version": gorm.Expr("version + 1"),
		})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return biz.ErrSalesDiagnosisConflict
		}
		if err := tx.Model(&model.SalesDiagnosisTask{}).Where("diagnosis_id = ? AND status IN ?", cmd.ID, []int32{model.SalesDiagnosisTaskStatusPending, model.SalesDiagnosisTaskStatusRunning}).Updates(map[string]any{
			"status": model.SalesDiagnosisTaskStatusCancelled, "completed_at": now,
			"lease_owner": "", "lease_token": "", "lease_expires_at": nil,
		}).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.SalesDiagnosisPreparation{}).
			Where("diagnosis_id = ? AND status IN ?", cmd.ID, []int32{model.SalesDiagnosisPreparationStatusPending, model.SalesDiagnosisPreparationStatusRunning}).
			Updates(map[string]any{
				"status": model.SalesDiagnosisPreparationStatusCancelled, "completed_at": now,
				"lease_owner": "", "lease_token": "", "lease_expires_at": nil,
			}).Error; err != nil {
			return err
		}
		return writeAdminAudit(ctx, tx, cmd.OperatorID, "sales_diagnosis.cancel", "sales_diagnosis", strconv.FormatUint(cmd.ID, 10), "success", cmd.Reason, diagnosis, map[string]any{"status": model.SalesDiagnosisStatusCancelled})
	})
}

func (r *salesDiagnosisRepo) PrepareRetry(ctx context.Context, taskID, operatorID uint64, reason string, access biz.SalesOpportunityAccess) (uint64, error) {
	var diagnosisID uint64
	err := r.data.WithinTransaction(ctx, func(tx *gorm.DB) error {
		var task model.SalesDiagnosisTask
		if err := tx.First(&task, taskID).Error; err != nil {
			return err
		}
		var diagnosis model.SalesDiagnosis
		if err := scopeSalesDiagnosisQuery(tx.Model(&model.SalesDiagnosis{}), access).First(&diagnosis, task.DiagnosisID).Error; err != nil {
			return err
		}
		if task.Status != model.SalesDiagnosisTaskStatusFailed || diagnosis.Status == model.SalesDiagnosisStatusCancelled {
			return biz.ErrSalesDiagnosisConflict
		}
		diagnosisID = diagnosis.ID
		now := time.Now().UTC()
		if err := tx.Model(&task).Updates(map[string]any{
			"status": model.SalesDiagnosisTaskStatusPending, "available_at": now, "completed_at": nil,
			"lease_owner": "", "lease_token": "", "lease_expires_at": nil,
		}).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.SalesDiagnosisReport{}).
			Where("diagnosis_id = ? AND is_current = TRUE", diagnosis.ID).
			Update("is_current", false).Error; err != nil {
			return err
		}
		if err := tx.Model(&diagnosis).Updates(map[string]any{"status": model.SalesDiagnosisStatusRunning, "completed_at": nil, "version": gorm.Expr("version + 1")}).Error; err != nil {
			return err
		}
		return writeAdminAudit(ctx, tx, operatorID, "sales_diagnosis.task.retry", "sales_diagnosis_task", strconv.FormatUint(taskID, 10), "success", reason, task, nil)
	})
	if err != nil {
		return 0, mapSalesDiagnosisError(err)
	}
	return diagnosisID, nil
}

func (r *salesDiagnosisRepo) Compare(ctx context.Context, baselineID, comparisonID uint64, access biz.SalesOpportunityAccess) (*biz.SalesDiagnosisComparison, error) {
	baseline, err := r.Get(ctx, baselineID, access)
	if err != nil {
		return nil, err
	}
	comparison, err := r.Get(ctx, comparisonID, access)
	if err != nil {
		return nil, err
	}
	if baseline.SubjectType != comparison.SubjectType || baseline.OpportunityID != comparison.OpportunityID || baseline.EnterpriseID != comparison.EnterpriseID {
		return nil, biz.ErrSalesDiagnosisInvalid
	}
	baselineMetrics := make(map[string]*biz.SalesDiagnosisMetric)
	for _, metric := range baseline.Metrics {
		if metric.DiagnosisModelID == 0 && metric.AvailabilityStatus == model.SalesDiagnosisMetricAvailabilityAvailable {
			baselineMetrics[metric.MetricCode] = metric
		}
	}
	comparisonMetrics := make(map[string]*biz.SalesDiagnosisMetric)
	for _, metric := range comparison.Metrics {
		if metric.DiagnosisModelID == 0 && metric.AvailabilityStatus == model.SalesDiagnosisMetricAvailabilityAvailable {
			comparisonMetrics[metric.MetricCode] = metric
		}
	}
	items := make([]*biz.SalesDiagnosisMetricComparison, 0, len(baselineMetrics))
	for code, before := range baselineMetrics {
		after, ok := comparisonMetrics[code]
		if !ok {
			continue
		}
		items = append(items, &biz.SalesDiagnosisMetricComparison{
			MetricCode: code, BaselineValue: before.Value, ComparisonValue: after.Value,
			Delta: after.Value - before.Value, BaselineSampleCount: before.SampleCount, ComparisonSampleCount: after.SampleCount,
		})
	}
	return &biz.SalesDiagnosisComparison{Baseline: baseline, Comparison: comparison, Metrics: items}, nil
}

func (r *salesDiagnosisRepo) loadRunTasks(ctx context.Context, diagnosisID, onlyTaskID uint64) ([]*biz.SalesDiagnosisRunTask, error) {
	if diagnosisID == 0 && onlyTaskID != 0 {
		var task model.SalesDiagnosisTask
		if err := r.data.DB(ctx).Select("diagnosis_id").First(&task, onlyTaskID).Error; err != nil {
			return nil, mapSalesDiagnosisError(err)
		}
		diagnosisID = task.DiagnosisID
	}
	diagnosis, err := r.Get(ctx, diagnosisID, biz.SalesOpportunityAccess{AdminUserID: 1, DataScope: biz.AdminRoleDataScopeAll})
	if err != nil {
		return nil, err
	}
	questions := make(map[uint64]string, len(diagnosis.Questions))
	for _, question := range diagnosis.Questions {
		questions[question.ID] = question.Question
	}
	models := make(map[uint64]*biz.SalesDiagnosisModel, len(diagnosis.Models))
	for _, diagnosisModel := range diagnosis.Models {
		models[diagnosisModel.ID] = diagnosisModel
	}
	items := make([]*biz.SalesDiagnosisRunTask, 0, len(diagnosis.Tasks))
	for _, task := range diagnosis.Tasks {
		if onlyTaskID != 0 && task.ID != onlyTaskID {
			continue
		}
		if onlyTaskID == 0 && task.Status != biz.SalesDiagnosisTaskStatusPending && task.Status != biz.SalesDiagnosisTaskStatusFailed {
			continue
		}
		attemptNo := task.AttemptCount + 1
		if task.Status == biz.SalesDiagnosisTaskStatusRunning {
			attemptNo = task.AttemptCount
		}
		items = append(items, &biz.SalesDiagnosisRunTask{
			DiagnosisID: diagnosis.ID, TaskID: task.ID, AttemptNo: attemptNo,
			Question: questions[task.QuestionID], Profile: diagnosis.Profile, Model: models[task.DiagnosisModelID],
			BrandTerms: diagnosis.BrandTerms,
		})
	}
	return items, nil
}

func (r *salesDiagnosisRepo) hydrate(ctx context.Context, records []model.SalesDiagnosis) ([]*biz.SalesDiagnosis, error) {
	items := make([]*biz.SalesDiagnosis, 0, len(records))
	if len(records) == 0 {
		return items, nil
	}
	ids := make([]uint64, 0, len(records))
	creatorIDs := make([]uint64, 0, len(records))
	byID := make(map[uint64]*biz.SalesDiagnosis, len(records))
	for i := range records {
		item := salesDiagnosisDO(&records[i])
		ids = append(ids, item.ID)
		creatorIDs = append(creatorIDs, item.CreatedByAdminID)
		byID[item.ID] = item
		items = append(items, item)
	}
	var creators []model.AdminUser
	if err := r.data.DB(ctx).Where("id IN ?", creatorIDs).Find(&creators).Error; err != nil {
		return nil, mapSalesDiagnosisError(err)
	}
	creatorNames := make(map[uint64]string, len(creators))
	for _, creator := range creators {
		creatorNames[creator.ID] = creator.DisplayName
	}
	for _, item := range items {
		item.CreatedByDisplayName = creatorNames[item.CreatedByAdminID]
	}
	if err := r.hydrateProfiles(ctx, ids, byID); err != nil {
		return nil, err
	}
	if err := r.hydratePreparations(ctx, ids, byID); err != nil {
		return nil, err
	}
	if err := r.hydrateExecution(ctx, ids, byID); err != nil {
		return nil, err
	}
	if err := r.hydrateReports(ctx, ids, byID); err != nil {
		return nil, err
	}
	return items, nil
}

func (r *salesDiagnosisRepo) hydratePreparations(ctx context.Context, ids []uint64, byID map[uint64]*biz.SalesDiagnosis) error {
	var preparations []model.SalesDiagnosisPreparation
	if err := r.data.DB(ctx).Where("diagnosis_id IN ?", ids).Find(&preparations).Error; err != nil {
		return mapSalesDiagnosisError(err)
	}
	preparationByID := make(map[uint64]*biz.SalesDiagnosisPreparation, len(preparations))
	preparationIDs := make([]uint64, 0, len(preparations))
	for _, item := range preparations {
		modelID := uint64(0)
		if item.DiagnosisModelID != nil {
			modelID = *item.DiagnosisModelID
		}
		preparation := &biz.SalesDiagnosisPreparation{
			ID: item.ID, DiagnosisModelID: modelID, Status: item.Status,
			AttemptCount: item.AttemptCount, LastErrorCode: item.LastErrorCode,
			LastErrorMessage: item.LastErrorMessage, StartedAt: item.StartedAt, CompletedAt: item.CompletedAt,
		}
		byID[item.DiagnosisID].Preparation = preparation
		preparationByID[item.ID] = preparation
		preparationIDs = append(preparationIDs, item.ID)
	}
	if len(preparationIDs) > 0 {
		var attempts []model.SalesDiagnosisPreparationAttempt
		if err := r.data.DB(ctx).Where("preparation_id IN ?", preparationIDs).Order("preparation_id, attempt_no").Find(&attempts).Error; err != nil {
			return err
		}
		for _, item := range attempts {
			preparationByID[item.PreparationID].Attempts = append(preparationByID[item.PreparationID].Attempts, &biz.SalesDiagnosisPreparationAttempt{
				ID: item.ID, AttemptNo: item.AttemptNo, Succeeded: item.Succeeded,
				Industry: item.Industry, BrandSummary: item.BrandSummary,
				PromptSnapshot: item.PromptSnapshot, RawResponseJSON: string(item.RawResponseJSON),
				ProviderRequestID: item.ProviderRequestID, ResponseModel: item.ResponseModel,
				InputTokens: item.InputTokens, OutputTokens: item.OutputTokens,
				CostMicros: item.CostMicros, DurationMS: item.DurationMS,
				ErrorCode: item.ErrorCode, ErrorMessage: item.ErrorMessage, CreatedAt: item.CreatedAt,
			})
		}
	}
	var terms []model.SalesDiagnosisBrandTerm
	if err := r.data.DB(ctx).Where("diagnosis_id IN ?", ids).Order("diagnosis_id, sort_order, id").Find(&terms).Error; err != nil {
		return err
	}
	for _, item := range terms {
		byID[item.DiagnosisID].BrandTerms = append(byID[item.DiagnosisID].BrandTerms, &biz.SalesDiagnosisBrandTerm{
			ID: item.ID, Term: item.Term, TermType: item.TermType, Reason: item.Reason, SortOrder: item.SortOrder,
		})
	}
	return nil
}

func (r *salesDiagnosisRepo) hydrateProfiles(ctx context.Context, ids []uint64, byID map[uint64]*biz.SalesDiagnosis) error {
	var profiles []model.SalesDiagnosisProfile
	if err := r.data.DB(ctx).Where("diagnosis_id IN ?", ids).Find(&profiles).Error; err != nil {
		return mapSalesDiagnosisError(err)
	}
	for i := range profiles {
		byID[profiles[i].DiagnosisID].Profile = salesDiagnosisProfileDO(&profiles[i])
	}
	var aliases []model.SalesDiagnosisProfileAlias
	if err := r.data.DB(ctx).Where("diagnosis_id IN ?", ids).Order("diagnosis_id, sort_order, id").Find(&aliases).Error; err != nil {
		return err
	}
	for _, alias := range aliases {
		byID[alias.DiagnosisID].Profile.BrandAliases = append(byID[alias.DiagnosisID].Profile.BrandAliases, alias.Alias)
	}
	var products []model.SalesDiagnosisProfileProduct
	if err := r.data.DB(ctx).Where("diagnosis_id IN ?", ids).Order("diagnosis_id, sort_order, id").Find(&products).Error; err != nil {
		return err
	}
	for _, product := range products {
		profile := byID[product.DiagnosisID].Profile
		profile.Products = append(profile.Products, &biz.SalesDiagnosisProfileProduct{
			Name: product.Name, Description: product.Description, SellingPoints: product.SellingPoints, TargetAudience: product.TargetAudience,
		})
	}
	var competitors []model.SalesDiagnosisProfileCompetitor
	if err := r.data.DB(ctx).Where("diagnosis_id IN ?", ids).Order("diagnosis_id, sort_order, id").Find(&competitors).Error; err != nil {
		return err
	}
	for _, competitor := range competitors {
		profile := byID[competitor.DiagnosisID].Profile
		profile.Competitors = append(profile.Competitors, &biz.SalesDiagnosisProfileCompetitor{
			Name: competitor.Name, Website: competitor.Website, Description: competitor.Description,
		})
	}
	var claims []model.SalesDiagnosisProfileClaim
	if err := r.data.DB(ctx).Where("diagnosis_id IN ?", ids).Order("diagnosis_id, sort_order, id").Find(&claims).Error; err != nil {
		return err
	}
	for _, claim := range claims {
		sourceItemID := uint64(0)
		if claim.SourceItemID != nil {
			sourceItemID = *claim.SourceItemID
		}
		byID[claim.DiagnosisID].Profile.Claims = append(byID[claim.DiagnosisID].Profile.Claims, &biz.SalesDiagnosisProfileClaim{
			ID: claim.ID, ClaimType: claim.ClaimType, SourceField: claim.SourceField,
			SourceItemID: sourceItemID, ClaimText: claim.ClaimText, SortOrder: claim.SortOrder,
		})
	}
	return nil
}

func diagnosisProfileClaims(diagnosisID uint64, profile *model.SalesDiagnosisProfile, products []model.SalesDiagnosisProfileProduct) []model.SalesDiagnosisProfileClaim {
	claims := make([]model.SalesDiagnosisProfileClaim, 0)
	appendClaims := func(claimType int32, sourceField string, sourceItemID *uint64, value string) {
		for _, text := range splitDiagnosisClaims(value) {
			claims = append(claims, model.SalesDiagnosisProfileClaim{
				DiagnosisID: diagnosisID, ClaimType: claimType, SourceField: sourceField,
				SourceItemID: sourceItemID, ClaimText: text, SortOrder: int32(len(claims)),
			})
		}
	}
	appendClaims(1, "core_value", nil, profile.CoreValue)
	appendClaims(3, "target_audience", nil, profile.TargetAudience)
	appendClaims(4, "current_content", nil, profile.CurrentContent)
	for i := range products {
		productID := products[i].ID
		appendClaims(2, "product_name", &productID, products[i].Name)
		appendClaims(2, "product_description", &productID, products[i].Description)
		appendClaims(2, "product_selling_points", &productID, products[i].SellingPoints)
		appendClaims(3, "product_target_audience", &productID, products[i].TargetAudience)
	}
	return claims
}

func splitDiagnosisClaims(value string) []string {
	parts := strings.FieldsFunc(value, func(r rune) bool {
		switch r {
		case '\n', '\r', '；', ';', '。':
			return true
		default:
			return false
		}
	})
	items := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if len([]rune(part)) >= 2 {
			items = append(items, part)
		}
	}
	return items
}

func (r *salesDiagnosisRepo) hydrateExecution(ctx context.Context, ids []uint64, byID map[uint64]*biz.SalesDiagnosis) error {
	var questions []model.SalesDiagnosisQuestion
	if err := r.data.DB(ctx).Where("diagnosis_id IN ?", ids).Order("diagnosis_id, sort_order, id").Find(&questions).Error; err != nil {
		return err
	}
	for _, question := range questions {
		byID[question.DiagnosisID].Questions = append(byID[question.DiagnosisID].Questions, &biz.SalesDiagnosisQuestion{
			ID: question.ID, Question: question.Question, SourceType: question.SourceType,
			Intent: question.Intent, Reason: question.Reason, SortOrder: question.SortOrder,
		})
	}
	var models []model.SalesDiagnosisModel
	if err := r.data.DB(ctx).Where("diagnosis_id IN ?", ids).Order("diagnosis_id, sort_order, id").Find(&models).Error; err != nil {
		return err
	}
	for i := range models {
		byID[models[i].DiagnosisID].Models = append(byID[models[i].DiagnosisID].Models, salesDiagnosisModelDO(&models[i]))
	}
	var tasks []model.SalesDiagnosisTask
	if err := r.data.DB(ctx).Where("diagnosis_id IN ?", ids).Order("diagnosis_id, id").Find(&tasks).Error; err != nil {
		return err
	}
	taskIDs := make([]uint64, 0, len(tasks))
	taskByID := make(map[uint64]*biz.SalesDiagnosisTask, len(tasks))
	for i := range tasks {
		task := salesDiagnosisTaskDO(&tasks[i])
		taskIDs = append(taskIDs, task.ID)
		taskByID[task.ID] = task
		byID[tasks[i].DiagnosisID].Tasks = append(byID[tasks[i].DiagnosisID].Tasks, task)
	}
	if len(taskIDs) > 0 {
		if err := r.hydrateResults(ctx, taskIDs, taskByID); err != nil {
			return err
		}
	}
	var metrics []model.SalesDiagnosisMetric
	if err := r.data.DB(ctx).Where("diagnosis_id IN ? AND is_current = TRUE", ids).Order("diagnosis_id, diagnosis_model_id, metric_code").Find(&metrics).Error; err != nil {
		return err
	}
	metricByID := make(map[uint64]*biz.SalesDiagnosisMetric, len(metrics))
	metricIDs := make([]uint64, 0, len(metrics))
	for _, metric := range metrics {
		modelID := uint64(0)
		if metric.ModelID != nil {
			modelID = *metric.ModelID
		}
		item := &biz.SalesDiagnosisMetric{
			ID: metric.ID, DiagnosisModelID: modelID, MetricCode: metric.MetricCode,
			Numerator: metric.Numerator, Denominator: metric.Denominator, Value: metric.Value,
			SampleCount: metric.SampleCount, AvailabilityStatus: metric.AvailabilityStatus, RuleVersion: metric.RuleVersion,
		}
		byID[metric.DiagnosisID].Metrics = append(byID[metric.DiagnosisID].Metrics, item)
		metricByID[metric.ID] = item
		metricIDs = append(metricIDs, metric.ID)
	}
	if len(metricIDs) > 0 {
		var samples []model.SalesDiagnosisMetricSample
		if err := r.data.DB(ctx).Where("metric_id IN ?", metricIDs).Order("metric_id, result_id").Find(&samples).Error; err != nil {
			return err
		}
		for _, sample := range samples {
			metricByID[sample.MetricID].Samples = append(metricByID[sample.MetricID].Samples, &biz.SalesDiagnosisMetricSample{
				ID: sample.ID, ResultID: sample.ResultID, NumeratorValue: sample.NumeratorValue,
				DenominatorValue: sample.DenominatorValue, Eligible: sample.Eligible, Reason: sample.Reason,
			})
		}
	}
	return nil
}

func (r *salesDiagnosisRepo) hydrateResults(ctx context.Context, taskIDs []uint64, taskByID map[uint64]*biz.SalesDiagnosisTask) error {
	var results []model.SalesDiagnosisResult
	if err := r.data.DB(ctx).Where("task_id IN ?", taskIDs).Order("task_id, attempt_no, id").Find(&results).Error; err != nil {
		return err
	}
	resultIDs := make([]uint64, 0, len(results))
	resultByID := make(map[uint64]*biz.SalesDiagnosisResult, len(results))
	for i := range results {
		item := salesDiagnosisResultDO(&results[i])
		resultIDs = append(resultIDs, item.ID)
		resultByID[item.ID] = item
		taskByID[item.TaskID].Results = append(taskByID[item.TaskID].Results, item)
	}
	if len(resultIDs) == 0 {
		return nil
	}
	var citations []model.SalesDiagnosisCitation
	if err := r.data.DB(ctx).Where("result_id IN ?", resultIDs).Order("result_id, sort_order, id").Find(&citations).Error; err != nil {
		return err
	}
	for _, citation := range citations {
		resultByID[citation.ResultID].Citations = append(resultByID[citation.ResultID].Citations, &biz.SalesDiagnosisCitation{
			ID: citation.ID, ProviderSourceID: citation.ProviderSourceID, SourceName: citation.SourceName,
			Title: citation.Title, URL: citation.URL, Domain: citation.Domain, Snippet: citation.Snippet,
			Position: citation.Position, OwnershipType: citation.OwnershipType, SourceType: citation.SourceType,
			VerificationStatus: citation.VerificationStatus, CapturedAt: citation.CapturedAt, SortOrder: citation.SortOrder,
		})
	}
	var mentions []model.SalesDiagnosisCompetitorMention
	if err := r.data.DB(ctx).Where("result_id IN ?", resultIDs).Order("result_id, id").Find(&mentions).Error; err != nil {
		return err
	}
	for _, mention := range mentions {
		resultByID[mention.ResultID].CompetitorMentions = append(resultByID[mention.ResultID].CompetitorMentions, &biz.SalesDiagnosisCompetitorMention{
			ID: mention.ID, CompetitorName: mention.CompetitorName, Position: mention.Position,
		})
	}
	var analyses []model.SalesDiagnosisResultAnalysis
	if err := r.data.DB(ctx).Where("result_id IN ?", resultIDs).Order("result_id, analysis_version DESC, id DESC").Find(&analyses).Error; err != nil {
		return err
	}
	analysisByID := make(map[uint64]*biz.SalesDiagnosisResultAnalysis, len(analyses))
	analysisIDs := make([]uint64, 0, len(analyses))
	for _, analysis := range analyses {
		result := resultByID[analysis.ResultID]
		if result.Analysis != nil {
			continue
		}
		item := &biz.SalesDiagnosisResultAnalysis{
			ID: analysis.ID, AnalysisVersion: analysis.AnalysisVersion, RuleVersion: analysis.RuleVersion,
			AnalyzerKind: analysis.AnalyzerKind, AnalyzerModelName: analysis.AnalyzerModelName,
			PromptSnapshot: analysis.PromptSnapshot, RawResponseJSON: string(analysis.RawResponseJSON),
			Status: analysis.Status, DominantSentiment: analysis.DominantSentiment,
			Confidence: analysis.Confidence, Included: analysis.Included,
			CompletenessScore: analysis.CompletenessScore, AnswerQualityScore: analysis.AnswerQualityScore,
			FreshnessScore: analysis.FreshnessScore, FreshnessAvailable: analysis.FreshnessAvailable,
			RecommendationPosition: analysis.RecommendationPosition, AnswerSummary: analysis.AnswerSummary,
			Strengths: analysis.Strengths, Gaps: analysis.Gaps, ErrorMessage: analysis.ErrorMessage,
		}
		result.Analysis = item
		analysisByID[analysis.ID] = item
		analysisIDs = append(analysisIDs, analysis.ID)
	}
	if len(analysisIDs) > 0 {
		var entities []model.SalesDiagnosisEntityMention
		if err := r.data.DB(ctx).Where("analysis_id IN ?", analysisIDs).Order("analysis_id, entity_type, id").Find(&entities).Error; err != nil {
			return err
		}
		for _, entity := range entities {
			entityRefID := uint64(0)
			if entity.EntityRefID != nil {
				entityRefID = *entity.EntityRefID
			}
			analysisByID[entity.AnalysisID].EntityMentions = append(analysisByID[entity.AnalysisID].EntityMentions, &biz.SalesDiagnosisEntityMention{
				ID: entity.ID, EntityType: entity.EntityType, EntityRefID: entityRefID,
				EntityName: entity.EntityName, MentionCount: entity.MentionCount,
				FirstPosition: entity.FirstPosition, RankPosition: entity.RankPosition,
				Sentiment: entity.Sentiment, Confidence: entity.Confidence, EvidenceExcerpt: entity.EvidenceExcerpt,
			})
		}
		var matches []model.SalesDiagnosisClaimMatch
		if err := r.data.DB(ctx).Where("analysis_id IN ?", analysisIDs).Order("analysis_id, claim_id").Find(&matches).Error; err != nil {
			return err
		}
		for _, match := range matches {
			analysisByID[match.AnalysisID].ClaimMatches = append(analysisByID[match.AnalysisID].ClaimMatches, &biz.SalesDiagnosisClaimMatch{
				ID: match.ID, ClaimID: match.ClaimID, Matched: match.Matched,
				Confidence: match.Confidence, EvidenceExcerpt: match.EvidenceExcerpt,
			})
		}
	}
	return nil
}

func diagnosisProfileSnapshot(tx *gorm.DB, cmd biz.CreateSalesDiagnosisCommand) (*model.SalesDiagnosisProfile, []model.SalesDiagnosisProfileAlias, []model.SalesDiagnosisProfileProduct, []model.SalesDiagnosisProfileCompetitor, error) {
	if cmd.SubjectType == biz.SalesDiagnosisSubjectQuickBrand {
		return &model.SalesDiagnosisProfile{
			CustomerName:  cmd.CustomerName,
			BrandName:     cmd.BrandName,
			SourceVersion: 1,
		}, nil, nil, nil, nil
	}
	if cmd.SubjectType == biz.SalesDiagnosisSubjectOpportunity {
		var opportunity model.SalesOpportunity
		if err := scopeSalesOpportunityQuery(tx.Model(&model.SalesOpportunity{}), cmd.Access).First(&opportunity, cmd.OpportunityID).Error; err != nil {
			return nil, nil, nil, nil, mapSalesDiagnosisError(err)
		}
		profile := &model.SalesDiagnosisProfile{
			CustomerName: opportunity.CustomerName, Website: opportunity.Website, Industry: opportunity.Industry,
			Region: opportunity.Region, BrandName: opportunity.BrandName, TargetAudience: opportunity.TargetAudience,
			CoreValue: opportunity.CoreValue, CurrentContent: opportunity.CurrentContent, PainPoints: opportunity.PainPoints,
			ExpectedGoals: opportunity.ExpectedGoals, SourceVersion: opportunity.Version,
		}
		var sourceAliases []model.SalesOpportunityBrandAlias
		if err := tx.Where("opportunity_id = ?", opportunity.ID).Order("sort_order, id").Find(&sourceAliases).Error; err != nil {
			return nil, nil, nil, nil, err
		}
		aliases := make([]model.SalesDiagnosisProfileAlias, 0, len(sourceAliases))
		for _, alias := range sourceAliases {
			aliases = append(aliases, model.SalesDiagnosisProfileAlias{Alias: alias.Alias, SortOrder: alias.SortOrder})
		}
		var sourceProducts []model.SalesOpportunityProduct
		if err := tx.Where("opportunity_id = ?", opportunity.ID).Order("sort_order, id").Find(&sourceProducts).Error; err != nil {
			return nil, nil, nil, nil, err
		}
		products := make([]model.SalesDiagnosisProfileProduct, 0, len(sourceProducts))
		for _, product := range sourceProducts {
			products = append(products, model.SalesDiagnosisProfileProduct{Name: product.Name, Description: product.Description, SellingPoints: product.SellingPoints, TargetAudience: product.TargetAudience, SortOrder: product.SortOrder})
		}
		var sourceCompetitors []model.SalesOpportunityCompetitor
		if err := tx.Where("opportunity_id = ?", opportunity.ID).Order("sort_order, id").Find(&sourceCompetitors).Error; err != nil {
			return nil, nil, nil, nil, err
		}
		competitors := make([]model.SalesDiagnosisProfileCompetitor, 0, len(sourceCompetitors))
		for _, competitor := range sourceCompetitors {
			competitors = append(competitors, model.SalesDiagnosisProfileCompetitor{Name: competitor.Name, Website: competitor.Website, Description: competitor.Description, SortOrder: competitor.SortOrder})
		}
		return profile, aliases, products, competitors, nil
	}
	var enterprise model.Enterprise
	if err := tx.First(&enterprise, cmd.EnterpriseID).Error; err != nil {
		return nil, nil, nil, nil, mapSalesDiagnosisError(err)
	}
	var brand model.Brand
	if err := tx.Where("enterprise_id = ? AND status = ?", enterprise.ID, 1).Order("id").First(&brand).Error; err != nil {
		return nil, nil, nil, nil, biz.ErrSalesDiagnosisInvalid
	}
	industry := brand.Industry
	if industry == "" {
		industry = enterprise.Industry
	}
	region := brand.Region
	if region == "" {
		region = enterprise.Region
	}
	profile := &model.SalesDiagnosisProfile{
		CustomerName: enterprise.Name, Website: brand.OfficialDomain, Industry: industry, Region: region,
		BrandName: brand.Name, TargetAudience: brand.TargetAudience, CoreValue: brand.CoreValue,
		CurrentContent: brand.Description, SourceVersion: brand.Version,
	}
	aliasValues := decodeStringList(brand.AliasesJSON)
	aliases := make([]model.SalesDiagnosisProfileAlias, 0, len(aliasValues))
	for i, alias := range aliasValues {
		aliases = append(aliases, model.SalesDiagnosisProfileAlias{Alias: alias, SortOrder: int32(i)})
	}
	var sourceProducts []model.Product
	if err := tx.Where("enterprise_id = ? AND brand_id = ?", enterprise.ID, brand.ID).Order("id").Find(&sourceProducts).Error; err != nil {
		return nil, nil, nil, nil, err
	}
	products := make([]model.SalesDiagnosisProfileProduct, 0, len(sourceProducts))
	for i, product := range sourceProducts {
		products = append(products, model.SalesDiagnosisProfileProduct{
			Name: product.Name, Description: product.Description, SellingPoints: strings.Join(decodeStringList(product.SellingPointsJSON), "；"),
			TargetAudience: product.TargetAudience, SortOrder: int32(i),
		})
	}
	var sourceCompetitors []model.Competitor
	if err := tx.Where("enterprise_id = ? AND brand_id = ?", enterprise.ID, brand.ID).Order("id").Find(&sourceCompetitors).Error; err != nil {
		return nil, nil, nil, nil, err
	}
	competitors := make([]model.SalesDiagnosisProfileCompetitor, 0, len(sourceCompetitors))
	for i, competitor := range sourceCompetitors {
		domains := decodeStringList(competitor.DomainsJSON)
		website := ""
		if len(domains) > 0 {
			website = domains[0]
		}
		competitors = append(competitors, model.SalesDiagnosisProfileCompetitor{
			Name: competitor.Name, Website: website, Description: competitor.Description, SortOrder: int32(i),
		})
	}
	return profile, aliases, products, competitors, nil
}

func diagnosisModelSnapshots(tx *gorm.DB, ids []uint64) ([]model.SalesDiagnosisModel, error) {
	if len(ids) == 0 {
		if err := tx.Model(&model.WritingModelPurpose{}).
			Select(model.TableWritingModelPurposes+".writing_model_id").
			Joins("JOIN "+model.TableWritingModels+" ON "+model.TableWritingModels+".id = "+model.TableWritingModelPurposes+".writing_model_id").
			Where(model.TableWritingModelPurposes+".purpose = ? AND "+model.TableWritingModels+".status = ? AND "+model.TableWritingModels+".deleted_at IS NULL", model.WritingModelPurposeSalesDiagnosis, model.WritingModelStatusActive).
			Order(model.TableWritingModels+".sort_order, "+model.TableWritingModels+".id").
			Limit(10).
			Pluck(model.TableWritingModelPurposes+".writing_model_id", &ids).Error; err != nil {
			return nil, err
		}
	}
	if len(ids) == 0 || len(ids) > 10 {
		return nil, biz.ErrSalesDiagnosisInvalid
	}
	var records []model.WritingModel
	if err := tx.Where("id IN ? AND status = ?", ids, model.WritingModelStatusActive).Find(&records).Error; err != nil {
		return nil, err
	}
	byID := make(map[uint64]model.WritingModel, len(records))
	for _, record := range records {
		byID[record.ID] = record
	}
	var purposes []model.WritingModelPurpose
	if err := tx.Where("writing_model_id IN ? AND purpose = ?", ids, model.WritingModelPurposeSalesDiagnosis).Find(&purposes).Error; err != nil {
		return nil, err
	}
	allowed := make(map[uint64]struct{}, len(purposes))
	for _, purpose := range purposes {
		allowed[purpose.WritingModelID] = struct{}{}
	}
	items := make([]model.SalesDiagnosisModel, 0, len(ids))
	for _, id := range ids {
		record, ok := byID[id]
		if !ok {
			return nil, biz.ErrSalesDiagnosisInvalid
		}
		if _, ok := allowed[id]; !ok {
			return nil, biz.ErrSalesDiagnosisInvalid
		}
		items = append(items, model.SalesDiagnosisModel{
			WritingModelID: id, DisplayName: record.DisplayName, Provider: record.Provider, Protocol: record.Protocol,
			BaseURL: record.BaseURL, ModelID: record.ModelID, ModelVersion: record.Version, Temperature: record.Temperature,
			TopP: record.TopP, MaxTokens: record.MaxTokens, TimeoutSeconds: record.TimeoutSeconds,
			InputPriceMicrosPerMillionTokens:  record.InputPriceMicrosPerMillionTokens,
			OutputPriceMicrosPerMillionTokens: record.OutputPriceMicrosPerMillionTokens,
			CitationCapability:                record.CitationCapability,
			DiagnosisAPIMode:                  record.DiagnosisAPIMode,
			DiagnosisWebSearchEnabled:         record.DiagnosisWebSearchEnabled,
		})
	}
	return items, nil
}

func replaceSalesDiagnosisMetrics(tx *gorm.DB, diagnosisID uint64) error {
	var generation uint64
	if err := tx.Model(&model.SalesDiagnosisMetric{}).
		Where("diagnosis_id = ?", diagnosisID).
		Select("COALESCE(MAX(generation), 0) + 1").
		Scan(&generation).Error; err != nil {
		return err
	}
	if generation == 0 {
		generation = 1
	}
	if err := tx.Model(&model.SalesDiagnosisMetric{}).
		Where("diagnosis_id = ? AND is_current = TRUE", diagnosisID).
		Update("is_current", false).Error; err != nil {
		return err
	}
	type resultRow struct {
		ResultID           uint64
		ModelID            uint64
		CitationCapability int32
		AnalysisID         *uint64
		AnalysisStatus     *int32
	}
	var rows []resultRow
	if err := tx.Raw(`
		SELECT r.id AS result_id, t.diagnosis_model_id AS model_id,
		       dm.citation_capability,
		       a.id AS analysis_id, a.status AS analysis_status
		FROM sls_diagnosis_tasks t
		JOIN sls_diagnosis_models dm ON dm.id = t.diagnosis_model_id
		JOIN sls_diagnosis_results r ON r.task_id = t.id AND r.attempt_no = t.attempt_count AND r.succeeded = TRUE
		LEFT JOIN sls_diagnosis_result_analyses a ON a.result_id = r.id AND a.analysis_version = 1
		WHERE t.diagnosis_id = ?`, diagnosisID).Scan(&rows).Error; err != nil {
		return err
	}
	if len(rows) == 0 {
		return nil
	}
	resultIDs := make([]uint64, 0, len(rows))
	analysisIDs := make([]uint64, 0, len(rows))
	for _, row := range rows {
		resultIDs = append(resultIDs, row.ResultID)
		if row.AnalysisID != nil {
			analysisIDs = append(analysisIDs, *row.AnalysisID)
		}
	}
	type entityRow struct {
		AnalysisID   uint64
		EntityType   int32
		MentionCount uint32
		RankPosition int32
		Sentiment    int32
	}
	var entities []entityRow
	if len(analysisIDs) > 0 {
		if err := tx.Model(&model.SalesDiagnosisEntityMention{}).
			Select("analysis_id, entity_type, mention_count, rank_position, sentiment").
			Where("analysis_id IN ?", analysisIDs).Scan(&entities).Error; err != nil {
			return err
		}
	}
	entitiesByAnalysis := make(map[uint64][]entityRow)
	for _, entity := range entities {
		entitiesByAnalysis[entity.AnalysisID] = append(entitiesByAnalysis[entity.AnalysisID], entity)
	}
	type matchAggregate struct {
		AnalysisID uint64
		Matched    int64
		Total      int64
	}
	var matches []matchAggregate
	if len(analysisIDs) > 0 {
		if err := tx.Model(&model.SalesDiagnosisClaimMatch{}).
			Select("analysis_id, SUM(CASE WHEN matched THEN 1 ELSE 0 END) AS matched, COUNT(*) AS total").
			Where("analysis_id IN ?", analysisIDs).Group("analysis_id").Scan(&matches).Error; err != nil {
			return err
		}
	}
	matchesByAnalysis := make(map[uint64]matchAggregate, len(matches))
	for _, match := range matches {
		matchesByAnalysis[match.AnalysisID] = match
	}
	type citationCount struct {
		ResultID uint64
		Count    int64
	}
	var citationCounts []citationCount
	if err := tx.Model(&model.SalesDiagnosisCitation{}).Select("result_id, COUNT(*) AS count").
		Where("result_id IN ?", resultIDs).Group("result_id").Scan(&citationCounts).Error; err != nil {
		return err
	}
	citationsByResult := make(map[uint64]int64, len(citationCounts))
	for _, item := range citationCounts {
		citationsByResult[item.ResultID] = item.Count
	}
	byModel := make(map[uint64][]diagnosisMetricDatum)
	for _, row := range rows {
		datum := diagnosisMetricDatum{ResultID: row.ResultID}
		if row.CitationCapability == model.SalesDiagnosisCitationCapabilityProviderSources || citationsByResult[row.ResultID] > 0 {
			datum.CitationEligible = 1
			if citationsByResult[row.ResultID] > 0 {
				datum.Cited = 1
			}
		}
		if row.AnalysisID != nil {
			datum.AnalysisSucceeded = row.AnalysisStatus != nil && *row.AnalysisStatus == 1
			hasExplicitRanking := false
			for _, entity := range entitiesByAnalysis[*row.AnalysisID] {
				datum.AllBrandMentions += float64(entity.MentionCount)
				if entity.RankPosition > 0 {
					hasExplicitRanking = true
				}
				if entity.EntityType != biz.SalesDiagnosisEntityTargetBrand {
					continue
				}
				datum.TargetMentions += float64(entity.MentionCount)
				if entity.MentionCount > 0 {
					datum.Mentioned = 1
					if entity.Sentiment != biz.SalesDiagnosisSentimentUnknown {
						datum.SentimentEligible = 1
					}
					switch entity.Sentiment {
					case biz.SalesDiagnosisSentimentPositive:
						datum.Positive = 1
					case biz.SalesDiagnosisSentimentNeutral:
						datum.Neutral = 1
					case biz.SalesDiagnosisSentimentNegative:
						datum.Negative = 1
					}
				}
				if entity.RankPosition > 0 {
					if entity.RankPosition <= 3 {
						datum.Top3 = 1
					}
				}
			}
			if hasExplicitRanking {
				datum.RankEligible = 1
			}
			match := matchesByAnalysis[*row.AnalysisID]
			if datum.AnalysisSucceeded && match.Total > 0 {
				datum.ClaimsMatched = float64(match.Matched)
				datum.ClaimsTotal = float64(match.Total)
			}
		}
		byModel[row.ModelID] = append(byModel[row.ModelID], datum)
		byModel[0] = append(byModel[0], datum)
	}
	for modelID, data := range byModel {
		var modelIDPtr *uint64
		if modelID != 0 {
			value := modelID
			modelIDPtr = &value
		}
		if err := createDiagnosisMetricSet(tx, diagnosisID, modelIDPtr, generation, data); err != nil {
			return err
		}
	}
	return nil
}

func createDiagnosisMetricSet(tx *gorm.DB, diagnosisID uint64, modelID *uint64, generation uint64, data []diagnosisMetricDatum) error {
	type definition struct {
		code        string
		numerator   func(diagnosisMetricDatum) float64
		denominator func(diagnosisMetricDatum) float64
		rawSum      bool
	}
	definitions := []definition{
		{"brand_mention_rate", func(v diagnosisMetricDatum) float64 { return v.Mentioned }, func(diagnosisMetricDatum) float64 { return 1 }, false},
		{"brand_mention_count", func(v diagnosisMetricDatum) float64 { return v.TargetMentions }, func(diagnosisMetricDatum) float64 { return 1 }, true},
		{"top3_rate", func(v diagnosisMetricDatum) float64 { return v.Top3 }, func(v diagnosisMetricDatum) float64 { return v.RankEligible }, false},
		{"content_adoption_rate", func(v diagnosisMetricDatum) float64 { return v.ClaimsMatched }, func(v diagnosisMetricDatum) float64 { return v.ClaimsTotal }, false},
		{"citation_rate", func(v diagnosisMetricDatum) float64 { return v.Cited }, func(v diagnosisMetricDatum) float64 { return v.CitationEligible }, false},
		{"brand_share_of_voice", func(v diagnosisMetricDatum) float64 { return v.TargetMentions }, func(v diagnosisMetricDatum) float64 { return v.AllBrandMentions }, false},
		{"positive_sentiment_rate", func(v diagnosisMetricDatum) float64 { return v.Positive }, func(v diagnosisMetricDatum) float64 { return v.SentimentEligible }, false},
		{"neutral_sentiment_rate", func(v diagnosisMetricDatum) float64 { return v.Neutral }, func(v diagnosisMetricDatum) float64 { return v.SentimentEligible }, false},
		{"negative_sentiment_rate", func(v diagnosisMetricDatum) float64 { return v.Negative }, func(v diagnosisMetricDatum) float64 { return v.SentimentEligible }, false},
	}
	for _, definition := range definitions {
		var numerator, denominator float64
		for _, datum := range data {
			numerator += definition.numerator(datum)
			denominator += definition.denominator(datum)
		}
		availability := model.SalesDiagnosisMetricAvailabilityAvailable
		if denominator == 0 {
			availability = model.SalesDiagnosisMetricAvailabilityUnavailable
		}
		value := float64(0)
		if definition.rawSum {
			value = numerator
		} else if denominator > 0 {
			value = numerator / denominator
		}
		metric := &model.SalesDiagnosisMetric{
			DiagnosisID: diagnosisID, ModelID: modelID, MetricCode: definition.code,
			Numerator: int64(numerator), Denominator: int64(denominator), Value: value,
			SampleCount: uint32(len(data)), AvailabilityStatus: availability, RuleVersion: "geo-report-v1",
			Generation: generation, IsCurrent: true,
		}
		if err := tx.Create(metric).Error; err != nil {
			return err
		}
		samples := make([]model.SalesDiagnosisMetricSample, 0, len(data))
		for _, datum := range data {
			n := definition.numerator(datum)
			d := definition.denominator(datum)
			reason := ""
			if d == 0 {
				reason = "该结果不具备此指标的有效计算条件"
			}
			samples = append(samples, model.SalesDiagnosisMetricSample{
				MetricID: metric.ID, ResultID: datum.ResultID, NumeratorValue: n,
				DenominatorValue: d, Eligible: d > 0, Reason: reason,
			})
		}
		if err := tx.Create(&samples).Error; err != nil {
			return err
		}
	}
	return nil
}

func scopeSalesDiagnosisQuery(db *gorm.DB, access biz.SalesOpportunityAccess) *gorm.DB {
	if access.CanAccessAll() {
		return db
	}
	return db.Where("created_by_admin_id = ? OR opportunity_id IN (SELECT id FROM sls_opportunities WHERE owner_admin_id = ? AND deleted_at IS NULL)", access.AdminUserID, access.AdminUserID)
}

func salesDiagnosisDO(po *model.SalesDiagnosis) *biz.SalesDiagnosis {
	item := &biz.SalesDiagnosis{
		ID: po.ID, Code: po.Code, Name: po.Name, SubjectType: po.SubjectType, CreatedByAdminID: po.CreatedByAdminID,
		Status: po.Status, QuestionCount: po.QuestionCount, ModelCount: po.ModelCount, TaskCount: po.TaskCount,
		SucceededTaskCount: po.SucceededTaskCount, FailedTaskCount: po.FailedTaskCount,
		StartedAt: po.StartedAt, CompletedAt: po.CompletedAt, Version: po.Version, CreatedAt: po.CreatedAt, UpdatedAt: po.UpdatedAt,
	}
	if po.OpportunityID != nil {
		item.OpportunityID = *po.OpportunityID
	}
	if po.EnterpriseID != nil {
		item.EnterpriseID = *po.EnterpriseID
	}
	return item
}

func salesDiagnosisProfileDO(po *model.SalesDiagnosisProfile) *biz.SalesDiagnosisProfile {
	return &biz.SalesDiagnosisProfile{
		CustomerName: po.CustomerName, Website: po.Website, Industry: po.Industry, Region: po.Region,
		BrandName: po.BrandName, TargetAudience: po.TargetAudience, CoreValue: po.CoreValue,
		CurrentContent: po.CurrentContent, PainPoints: po.PainPoints, ExpectedGoals: po.ExpectedGoals, SourceVersion: po.SourceVersion,
	}
}

func salesDiagnosisModelDO(po *model.SalesDiagnosisModel) *biz.SalesDiagnosisModel {
	return &biz.SalesDiagnosisModel{
		ID: po.ID, WritingModelID: po.WritingModelID, DisplayName: po.DisplayName, Provider: po.Provider,
		Protocol: po.Protocol, BaseURL: po.BaseURL, ModelID: po.ModelID, ModelVersion: po.ModelVersion,
		Temperature: po.Temperature, TopP: po.TopP, MaxTokens: po.MaxTokens, TimeoutSeconds: po.TimeoutSeconds,
		InputPriceMicrosPerMillionTokens:  po.InputPriceMicrosPerMillionTokens,
		OutputPriceMicrosPerMillionTokens: po.OutputPriceMicrosPerMillionTokens,
		CitationCapability:                po.CitationCapability, SortOrder: po.SortOrder,
		DiagnosisAPIMode:          po.DiagnosisAPIMode,
		DiagnosisWebSearchEnabled: po.DiagnosisWebSearchEnabled,
	}
}

func salesDiagnosisTaskDO(po *model.SalesDiagnosisTask) *biz.SalesDiagnosisTask {
	return &biz.SalesDiagnosisTask{
		ID: po.ID, QuestionID: po.QuestionID, DiagnosisModelID: po.DiagnosisModelID, Status: po.Status,
		AttemptCount: po.AttemptCount, LastErrorCode: po.LastErrorCode, LastErrorMessage: po.LastErrorMessage,
		StartedAt: po.StartedAt, CompletedAt: po.CompletedAt,
	}
}

func salesDiagnosisResultDO(po *model.SalesDiagnosisResult) *biz.SalesDiagnosisResult {
	return &biz.SalesDiagnosisResult{
		ID: po.ID, TaskID: po.TaskID, AttemptNo: po.AttemptNo, Succeeded: po.Succeeded, Answer: po.Answer,
		RawResponseJSON: string(po.RawResponseJSON), ProviderRequestID: po.ProviderRequestID, ResponseModel: po.ResponseModel,
		PromptSnapshot: po.PromptSnapshot, EvidenceType: po.EvidenceType, InputTokens: po.InputTokens,
		OutputTokens: po.OutputTokens, CostMicros: po.CostMicros, DurationMS: po.DurationMS,
		BrandMentioned: po.BrandMentioned, BrandPosition: po.BrandPosition, ErrorCode: po.ErrorCode,
		ErrorMessage: po.ErrorMessage, CreatedAt: po.CreatedAt,
	}
}

func decodeStringList(value []byte) []string {
	var items []string
	if len(value) == 0 || json.Unmarshal(value, &items) != nil {
		return nil
	}
	return items
}

func truncateDiagnosisError(value string) string {
	runes := []rune(strings.TrimSpace(value))
	if len(runes) > 1000 {
		return string(runes[:1000])
	}
	return string(runes)
}

func newDiagnosisLeaseToken() (string, error) {
	var value [16]byte
	if _, err := rand.Read(value[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(value[:]), nil
}

func mapSalesDiagnosisError(err error) error {
	if err == nil || errors.Is(err, biz.ErrSalesDiagnosisInvalid) || errors.Is(err, biz.ErrSalesDiagnosisConflict) || errors.Is(err, biz.ErrSalesDiagnosisForbidden) {
		return err
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return biz.ErrSalesDiagnosisNotFound
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return biz.ErrSalesDiagnosisConflict
	}
	return fmt.Errorf("sales diagnosis repository: %w", err)
}
