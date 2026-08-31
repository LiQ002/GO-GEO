package data

import (
	"testing"

	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/data/model"
)

func TestNewDistilledQuestionStartsPendingReview(t *testing.T) {
	t.Parallel()

	question := newDistilledQuestion(&model.KeywordDistillationTask{
		TenantModel: model.TenantModel{EnterpriseID: 7},
		KeywordID:   11,
		BrandID:     13,
	}, 0, biz.DistilledQuestion{Text: "用户会搜索什么？"})

	if question.Status != biz.QuestionStatusPending {
		t.Fatalf("status = %d, want pending (%d)", question.Status, biz.QuestionStatusPending)
	}
	if question.Source != biz.QuestionSourceDistilled {
		t.Fatalf("source = %d, want distilled (%d)", question.Source, biz.QuestionSourceDistilled)
	}
}
