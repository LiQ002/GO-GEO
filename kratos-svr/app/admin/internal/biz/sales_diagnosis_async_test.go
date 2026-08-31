package biz

import (
	"context"
	"errors"
	"testing"
	"time"
)

type salesDiagnosisRepoStub struct {
	diagnosis           *SalesDiagnosis
	createdCommand      CreateSalesDiagnosisCommand
	claimedTask         *SalesDiagnosisRunTask
	claimedPreparation  *SalesDiagnosisPreparationTask
	enqueueCalls        int
	recordedResult      *SalesDiagnosisResult
	recordedPreparation *SalesDiagnosisPreparationResult
	finalizeCalls       int
	finalizedID         uint64
	finalizationID      uint64
	finalizationErr     error
	retryDiagnosisID    uint64
}

func (r *salesDiagnosisRepoStub) Create(_ context.Context, cmd CreateSalesDiagnosisCommand) (*SalesDiagnosis, error) {
	r.createdCommand = cmd
	return r.diagnosis, nil
}
func (r *salesDiagnosisRepoStub) Get(context.Context, uint64, SalesOpportunityAccess) (*SalesDiagnosis, error) {
	return r.diagnosis, nil
}
func (r *salesDiagnosisRepoStub) List(context.Context, SalesDiagnosisListOptions, SalesOpportunityAccess) ([]*SalesDiagnosis, int64, error) {
	return nil, 0, nil
}
func (r *salesDiagnosisRepoStub) Enqueue(context.Context, uint64, uint64, SalesOpportunityAccess) error {
	r.enqueueCalls++
	return nil
}
func (r *salesDiagnosisRepoStub) ClaimNext(context.Context, string, time.Time, time.Duration) (*SalesDiagnosisRunTask, error) {
	return r.claimedTask, nil
}
func (r *salesDiagnosisRepoStub) ClaimNextPreparation(context.Context, string, time.Time, time.Duration) (*SalesDiagnosisPreparationTask, error) {
	return r.claimedPreparation, nil
}
func (r *salesDiagnosisRepoStub) RecordPreparation(_ context.Context, result *SalesDiagnosisPreparationResult) error {
	r.recordedPreparation = result
	return nil
}
func (r *salesDiagnosisRepoStub) RecordResult(_ context.Context, result *SalesDiagnosisResult) error {
	r.recordedResult = result
	return nil
}
func (r *salesDiagnosisRepoStub) FindPendingFinalization(context.Context) (uint64, error) {
	return r.finalizationID, nil
}
func (r *salesDiagnosisRepoStub) Finalize(_ context.Context, diagnosisID uint64) error {
	r.finalizeCalls++
	r.finalizedID = diagnosisID
	return r.finalizationErr
}
func (r *salesDiagnosisRepoStub) Cancel(context.Context, SalesDiagnosisCancelCommand) error {
	return nil
}
func (r *salesDiagnosisRepoStub) PrepareRetry(context.Context, uint64, uint64, string, SalesOpportunityAccess) (uint64, error) {
	return r.retryDiagnosisID, nil
}
func (r *salesDiagnosisRepoStub) Compare(context.Context, uint64, uint64, SalesOpportunityAccess) (*SalesDiagnosisComparison, error) {
	return nil, nil
}

type salesDiagnosisRunnerStub struct {
	calls             int
	preparationCalls  int
	result            *SalesDiagnosisResult
	preparationResult *SalesDiagnosisPreparationResult
}

func (r *salesDiagnosisRunnerStub) Prepare(context.Context, *SalesDiagnosisPreparationTask) (*SalesDiagnosisPreparationResult, error) {
	r.preparationCalls++
	return r.preparationResult, nil
}

func (r *salesDiagnosisRunnerStub) Run(context.Context, *SalesDiagnosisRunTask) (*SalesDiagnosisResult, error) {
	r.calls++
	return r.result, nil
}

func TestSalesDiagnosisProcessNextPreparesQuestionsBeforeModelTasks(t *testing.T) {
	t.Parallel()

	repo := &salesDiagnosisRepoStub{claimedPreparation: &SalesDiagnosisPreparationTask{
		DiagnosisID: 11, PreparationID: 12, AttemptNo: 2, LeaseToken: "prep-2",
		Profile: &SalesDiagnosisProfile{CustomerName: "客户", BrandName: "品牌"},
		Model:   &SalesDiagnosisModel{TimeoutSeconds: 1},
	}}
	runner := &salesDiagnosisRunnerStub{preparationResult: &SalesDiagnosisPreparationResult{
		PreparationID: 12, AttemptNo: 2, Succeeded: true,
	}}
	uc := NewSalesDiagnosisUsecase(repo, runner)

	processed, err := uc.ProcessNext(context.Background(), "worker-1", time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	if !processed || runner.preparationCalls != 1 || runner.calls != 0 {
		t.Fatalf("ProcessNext() processed=%v, preparation=%d, model=%d", processed, runner.preparationCalls, runner.calls)
	}
	if repo.recordedPreparation == nil || repo.recordedPreparation.LeaseToken != "prep-2" {
		t.Fatalf("recorded preparation = %#v", repo.recordedPreparation)
	}
	if repo.finalizeCalls != 0 {
		t.Fatalf("preparation should not finalize report, calls=%d", repo.finalizeCalls)
	}
}

func TestSalesDiagnosisEnqueueDoesNotCallModel(t *testing.T) {
	t.Parallel()

	repo := &salesDiagnosisRepoStub{diagnosis: &SalesDiagnosis{ID: 9, Version: 2}}
	runner := &salesDiagnosisRunnerStub{}
	uc := NewSalesDiagnosisUsecase(repo, runner)
	access := SalesOpportunityAccess{AdminUserID: 3, DataScope: AdminRoleDataScopeAll}

	got, err := uc.Enqueue(context.Background(), 9, 1, access)
	if err != nil {
		t.Fatal(err)
	}
	if got.ID != 9 || repo.enqueueCalls != 1 {
		t.Fatalf("Enqueue() diagnosis = %#v, calls = %d", got, repo.enqueueCalls)
	}
	if runner.calls != 0 {
		t.Fatalf("Enqueue() called model runner %d times; want 0", runner.calls)
	}
}

func TestSalesDiagnosisCreateAllowsAutomaticQuickBrandDefaults(t *testing.T) {
	t.Parallel()

	repo := &salesDiagnosisRepoStub{diagnosis: &SalesDiagnosis{ID: 9, Version: 1}}
	uc := NewSalesDiagnosisUsecase(repo, &salesDiagnosisRunnerStub{})
	access := SalesOpportunityAccess{AdminUserID: 3, DataScope: AdminRoleDataScopeAll}

	_, err := uc.Create(context.Background(), CreateSalesDiagnosisCommand{
		SubjectType:  SalesDiagnosisSubjectQuickBrand,
		CustomerName: " 星河科技有限公司 ",
		BrandName:    " 星河云 ",
		OperatorID:   3,
		Access:       access,
	})
	if err != nil {
		t.Fatal(err)
	}
	if repo.createdCommand.Name != "星河云 GEO 售前诊断" || repo.createdCommand.CustomerName != "星河科技有限公司" || repo.createdCommand.BrandName != "星河云" {
		t.Fatalf("Create() command = %#v", repo.createdCommand)
	}
	if len(repo.createdCommand.Questions) != 0 || len(repo.createdCommand.WritingModelIDs) != 0 {
		t.Fatalf("Create() should defer automatic questions and model selection to repository: %#v", repo.createdCommand)
	}
}

func TestSalesDiagnosisProcessNextPersistsLeaseResult(t *testing.T) {
	t.Parallel()

	repo := &salesDiagnosisRepoStub{claimedTask: &SalesDiagnosisRunTask{
		DiagnosisID: 11, TaskID: 22, AttemptNo: 3, LeaseToken: "lease-3",
		Question: "问题", Profile: &SalesDiagnosisProfile{BrandName: "品牌"},
		Model: &SalesDiagnosisModel{TimeoutSeconds: 1},
	}}
	runner := &salesDiagnosisRunnerStub{result: &SalesDiagnosisResult{TaskID: 22, AttemptNo: 3, Succeeded: true}}
	uc := NewSalesDiagnosisUsecase(repo, runner)

	processed, err := uc.ProcessNext(context.Background(), "worker-1", time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	if !processed || runner.calls != 1 {
		t.Fatalf("ProcessNext() processed = %v, runner calls = %d", processed, runner.calls)
	}
	if repo.recordedResult == nil || repo.recordedResult.LeaseToken != "lease-3" {
		t.Fatalf("ProcessNext() recorded result = %#v", repo.recordedResult)
	}
	if repo.finalizedID != 11 {
		t.Fatalf("ProcessNext() finalized diagnosis = %d, want 11", repo.finalizedID)
	}
}

func TestSalesDiagnosisRetryOnlyQueuesTask(t *testing.T) {
	t.Parallel()

	repo := &salesDiagnosisRepoStub{
		diagnosis: &SalesDiagnosis{ID: 15}, retryDiagnosisID: 15,
	}
	runner := &salesDiagnosisRunnerStub{}
	uc := NewSalesDiagnosisUsecase(repo, runner)
	access := SalesOpportunityAccess{AdminUserID: 3, DataScope: AdminRoleDataScopeAll}

	got, err := uc.RetryTask(context.Background(), 7, 3, "重试", access)
	if err != nil {
		t.Fatal(err)
	}
	if got.ID != 15 || runner.calls != 0 {
		t.Fatalf("RetryTask() diagnosis = %#v, runner calls = %d", got, runner.calls)
	}
}

func TestSalesDiagnosisReconcileNextCompletesFinalizationWithoutCallingModel(t *testing.T) {
	t.Parallel()

	repo := &salesDiagnosisRepoStub{finalizationID: 17}
	runner := &salesDiagnosisRunnerStub{}
	uc := NewSalesDiagnosisUsecase(repo, runner)

	processed, err := uc.ReconcileNext(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if !processed || repo.finalizedID != 17 || repo.finalizeCalls != 1 {
		t.Fatalf("ReconcileNext() processed = %v, finalized = %d, calls = %d", processed, repo.finalizedID, repo.finalizeCalls)
	}
	if runner.calls != 0 || repo.recordedResult != nil {
		t.Fatalf("ReconcileNext() reran model: runner calls = %d, result = %#v", runner.calls, repo.recordedResult)
	}
}

func TestSalesDiagnosisReconcileNextReturnsErrorForRetry(t *testing.T) {
	t.Parallel()

	wantErr := errors.New("temporary report error")
	repo := &salesDiagnosisRepoStub{finalizationID: 18, finalizationErr: wantErr}
	uc := NewSalesDiagnosisUsecase(repo, &salesDiagnosisRunnerStub{})

	processed, err := uc.ReconcileNext(context.Background())
	if !processed || !errors.Is(err, wantErr) {
		t.Fatalf("ReconcileNext() = (%v, %v), want processed reconciliation error", processed, err)
	}
}
