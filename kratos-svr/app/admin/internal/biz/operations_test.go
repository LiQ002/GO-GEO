package biz

import (
	"context"
	"testing"
)

func TestAdminArticleUsecaseRejectsInvalidReview(t *testing.T) {
	uc := NewAdminArticleUsecase(nil)
	for _, action := range []string{"", "publish", "archive"} {
		_, err := uc.Review(context.Background(), AdminArticleAction{ID: 1, Version: 1, OperatorID: 1, Action: action, Reason: "test"})
		if err != ErrArticleInvalid {
			t.Errorf("Review(action=%q) error = %v, want %v", action, err, ErrArticleInvalid)
		}
	}
}

func TestAdminTaskUsecasesRequireReason(t *testing.T) {
	_, publishErr := NewAdminPublishTaskUsecase(nil).ChangeStatus(context.Background(), AdminPublishTaskAction{ID: 1, Version: 1, OperatorID: 1, Action: "retry"})
	if publishErr != ErrPublishTaskInvalid {
		t.Errorf("publish ChangeStatus() error = %v, want %v", publishErr, ErrPublishTaskInvalid)
	}
	_, geoErr := NewAdminGeoTaskUsecase(nil).ChangeStatus(context.Background(), AdminGeoTaskAction{ID: 1, Version: 1, OperatorID: 1, Action: "cancel"})
	if geoErr != ErrGeoTaskInvalid {
		t.Errorf("GEO ChangeStatus() error = %v, want %v", geoErr, ErrGeoTaskInvalid)
	}
}

func TestAdminManualReviewRequiresValidJSON(t *testing.T) {
	_, err := NewAdminGeoTaskUsecase(nil).CreateManualReview(context.Background(), AdminManualReviewCommand{TaskID: 1, AnswerSnapshotID: 2, OperatorID: 3, AfterJSON: "not-json", Reason: "correct extraction"})
	if err != ErrGeoTaskInvalid {
		t.Fatalf("CreateManualReview() error = %v, want %v", err, ErrGeoTaskInvalid)
	}
}

func TestSystemSettingRequiresJSONAndAuditReason(t *testing.T) {
	uc := NewSystemSettingUsecase(nil)
	for _, command := range []SystemSettingCommand{
		{Setting: &SystemSetting{Namespace: "runtime", Key: "limits", ValueJSON: "invalid"}, OperatorID: 1, Reason: "change"},
		{Setting: &SystemSetting{Namespace: "runtime", Key: "limits", ValueJSON: "{}"}, OperatorID: 1},
	} {
		_, err := uc.Create(context.Background(), command)
		if err != ErrSystemSettingInvalid {
			t.Errorf("Create(%+v) error = %v, want %v", command, err, ErrSystemSettingInvalid)
		}
	}
}

func TestWorkerAdminRejectsUntrackedAction(t *testing.T) {
	_, err := NewWorkerAdminUsecase(nil).ChangeStatus(context.Background(), WorkerStatusCommand{ID: 1, Version: 1, OperatorID: 1, Action: "delete", Reason: "test"})
	if err != ErrWorkerInvalid {
		t.Fatalf("ChangeStatus() error = %v, want %v", err, ErrWorkerInvalid)
	}
}
