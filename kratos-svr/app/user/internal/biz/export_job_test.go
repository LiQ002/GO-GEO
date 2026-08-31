package biz

import (
	"context"
	"errors"
	"testing"
)

type exportJobRepoStub struct{ created *ExportJob }

func (r *exportJobRepoStub) Create(_ context.Context, job *ExportJob) (*ExportJob, error) {
	r.created = job
	return job, nil
}
func (*exportJobRepoStub) Get(context.Context, uint64, uint64, uint64) (*ExportJob, error) {
	return nil, nil
}
func (*exportJobRepoStub) List(context.Context, uint64, uint64, ExportJobListOptions) ([]*ExportJob, int64, error) {
	return nil, 0, nil
}
func (*exportJobRepoStub) Cancel(context.Context, uint64, uint64, uint64) (*ExportJob, error) {
	return nil, nil
}

func TestExportJobUsecaseValidatesFormatCompatibility(t *testing.T) {
	u := NewExportJobUsecase(&exportJobRepoStub{})
	for _, job := range []*ExportJob{
		{EnterpriseID: 1, RequestedByID: 2, ResourceType: "articles", Format: "pdf", FilterJSON: "{}", ClientRequestID: "one"},
		{EnterpriseID: 1, RequestedByID: 2, ResourceType: "unknown", Format: "csv", FilterJSON: "{}", ClientRequestID: "two"},
		{EnterpriseID: 1, RequestedByID: 2, ResourceType: "geo_report", Format: "pdf", FilterJSON: "[]", ClientRequestID: "three"},
	} {
		if _, err := u.Create(context.Background(), job); !errors.Is(err, ErrExportJobInvalid) {
			t.Fatalf("Create(%+v) error = %v", job, err)
		}
	}
}

func TestExportJobUsecaseNormalizesCreate(t *testing.T) {
	repo := &exportJobRepoStub{}
	u := NewExportJobUsecase(repo)
	_, err := u.Create(context.Background(), &ExportJob{
		EnterpriseID: 1, RequestedByID: 2, ResourceType: "geo_report", Format: " XLSX ", ClientRequestID: " request-1 ",
	})
	if err != nil {
		t.Fatal(err)
	}
	if repo.created.Status != "queued" || repo.created.Format != "xlsx" || repo.created.FilterJSON != "{}" || repo.created.ClientRequestID != "request-1" {
		t.Fatalf("normalized job = %+v", repo.created)
	}
}
