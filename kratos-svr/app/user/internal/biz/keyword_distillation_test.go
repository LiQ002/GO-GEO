package biz

import (
	"context"
	"errors"
	"testing"
)

func TestKeywordDistillationPersistsInvalidModelOutput(t *testing.T) {
	t.Parallel()

	repo := &keywordDistillationRepoStub{
		create: func(_ context.Context, input KeywordDistillationInput) (*KeywordDistillationTask, bool, error) {
			return &KeywordDistillationTask{ID: 9, EnterpriseID: input.EnterpriseID, RequestedCount: input.QuestionCount, Status: KeywordDistillationStatusPending}, true, nil
		},
		start: func(_ context.Context, enterpriseID, id uint64, retry bool) (*KeywordDistillationTask, error) {
			return &KeywordDistillationTask{ID: id, EnterpriseID: enterpriseID, RequestedCount: 3, Status: KeywordDistillationStatusRunning}, nil
		},
		fail: func(_ context.Context, enterpriseID, id uint64, code, message string) (*KeywordDistillationTask, error) {
			if code != "MODEL_INVALID_OUTPUT" {
				t.Fatalf("failure code = %q", code)
			}
			return &KeywordDistillationTask{ID: id, EnterpriseID: enterpriseID, Status: KeywordDistillationStatusFailed, ErrorCode: code}, nil
		},
	}
	usecase := NewKeywordDistillationUsecase(repo, keywordDistillerStub{result: &KeywordDistillationResult{Questions: []DistilledQuestion{}}})
	task, err := usecase.execute(context.Background(), &KeywordDistillationTask{ID: 9, EnterpriseID: 1, RequestedCount: 3, Status: KeywordDistillationStatusPending}, false)
	if err != nil {
		return
	}
	if task.Status != KeywordDistillationStatusFailed || task.ErrorCode != "MODEL_INVALID_OUTPUT" {
		t.Fatalf("task = %#v", task)
	}
}

func TestKeywordDistillationFailsOnInsufficientOutput(t *testing.T) {
	t.Parallel()

	repo := &keywordDistillationRepoStub{
		create: func(_ context.Context, input KeywordDistillationInput) (*KeywordDistillationTask, bool, error) {
			return &KeywordDistillationTask{ID: 9, EnterpriseID: input.EnterpriseID, RequestedCount: input.QuestionCount, Status: KeywordDistillationStatusPending}, true, nil
		},
		start: func(_ context.Context, enterpriseID, id uint64, retry bool) (*KeywordDistillationTask, error) {
			return &KeywordDistillationTask{ID: id, EnterpriseID: enterpriseID, RequestedCount: 10, Status: KeywordDistillationStatusRunning}, nil
		},
		fail: func(_ context.Context, enterpriseID, id uint64, code, message string) (*KeywordDistillationTask, error) {
			if code != "MODEL_INSUFFICIENT_OUTPUT" {
				t.Fatalf("failure code = %q", code)
			}
			return &KeywordDistillationTask{ID: id, EnterpriseID: enterpriseID, Status: KeywordDistillationStatusFailed, ErrorCode: code}, nil
		},
	}
	// 请求 10 个，只返回 3 个（30%），低于 85% 阈值，应判定失败。
	usecase := NewKeywordDistillationUsecase(repo, keywordDistillerStub{result: &KeywordDistillationResult{Questions: []DistilledQuestion{{Text: "a"}, {Text: "b"}, {Text: "c"}}}})
	task, err := usecase.execute(context.Background(), &KeywordDistillationTask{ID: 9, EnterpriseID: 1, RequestedCount: 10, Status: KeywordDistillationStatusPending}, false)
	if err != nil {
		return
	}
	if task.Status != KeywordDistillationStatusFailed || task.ErrorCode != "MODEL_INSUFFICIENT_OUTPUT" {
		t.Fatalf("task = %#v", task)
	}
}

// TestKeywordDistillationFailsOn56PercentRatio 验证 50→28 这种"数量严重不足但仍超 50%"的场景
// 在新阈值 0.85 下会被判失败（旧阈值 0.5 会误判为成功）。
// 这是本次修复的核心行为变更：minRatio 从 0.5 提到 0.85，避免质量问题被静默吞掉。
func TestKeywordDistillationFailsOn56PercentRatio(t *testing.T) {
	t.Parallel()

	repo := &keywordDistillationRepoStub{
		start: func(_ context.Context, enterpriseID, id uint64, retry bool) (*KeywordDistillationTask, error) {
			return &KeywordDistillationTask{ID: id, EnterpriseID: enterpriseID, RequestedCount: 50, Status: KeywordDistillationStatusRunning}, nil
		},
		fail: func(_ context.Context, enterpriseID, id uint64, code, message string) (*KeywordDistillationTask, error) {
			if code != "MODEL_INSUFFICIENT_OUTPUT" {
				t.Fatalf("failure code = %q, want MODEL_INSUFFICIENT_OUTPUT", code)
			}
			return &KeywordDistillationTask{ID: id, EnterpriseID: enterpriseID, Status: KeywordDistillationStatusFailed, ErrorCode: code}, nil
		},
	}
	// 请求 50 个，只返回 28 个（56%），低于 85% 阈值但高于旧 50% 阈值。
	questions := make([]DistilledQuestion, 28)
	for i := range questions {
		questions[i] = DistilledQuestion{Text: string(rune('a' + i%26)) + string(rune('a'+i/26))}
	}
	usecase := NewKeywordDistillationUsecase(repo, keywordDistillerStub{result: &KeywordDistillationResult{Questions: questions}})
	task, err := usecase.execute(context.Background(), &KeywordDistillationTask{ID: 9, EnterpriseID: 1, RequestedCount: 50, Status: KeywordDistillationStatusPending}, false)
	if err != nil {
		return
	}
	if task.Status != KeywordDistillationStatusFailed || task.ErrorCode != "MODEL_INSUFFICIENT_OUTPUT" {
		t.Fatalf("task = %#v, want failed with MODEL_INSUFFICIENT_OUTPUT", task)
	}
}

func TestKeywordDistillationRejectsQuestionCountOutsideLimit(t *testing.T) {
	t.Parallel()

	usecase := NewKeywordDistillationUsecase(&keywordDistillationRepoStub{}, keywordDistillerStub{})
	input := validKeywordDistillationInput()
	input.QuestionCount = 101
	_, err := usecase.Create(context.Background(), input)
	if !errors.Is(err, ErrKeywordDistillationInvalid) {
		t.Fatalf("Create() error = %v, want %v", err, ErrKeywordDistillationInvalid)
	}
}

func validKeywordDistillationInput() KeywordDistillationInput {
	return KeywordDistillationInput{EnterpriseID: 1, OperatorID: 2, KeywordID: 3, ClientRequestID: "distill-1", Region: "北京", QuestionCount: 3}
}

type keywordDistillationRepoStub struct {
	create func(context.Context, KeywordDistillationInput) (*KeywordDistillationTask, bool, error)
	start  func(context.Context, uint64, uint64, bool) (*KeywordDistillationTask, error)
	fail   func(context.Context, uint64, uint64, string, string) (*KeywordDistillationTask, error)
}

func (s *keywordDistillationRepoStub) Create(ctx context.Context, input KeywordDistillationInput) (*KeywordDistillationTask, bool, error) {
	if s.create == nil {
		return nil, false, errors.New("unexpected Create call")
	}
	return s.create(ctx, input)
}
func (*keywordDistillationRepoStub) Get(context.Context, uint64, uint64) (*KeywordDistillationTask, error) {
	return nil, errors.New("unexpected Get call")
}
func (*keywordDistillationRepoStub) List(context.Context, uint64, KeywordDistillationListOptions) ([]*KeywordDistillationTask, int64, error) {
	return nil, 0, errors.New("unexpected List call")
}
func (s *keywordDistillationRepoStub) Start(ctx context.Context, enterpriseID, id uint64, retry bool) (*KeywordDistillationTask, error) {
	if s.start == nil {
		return nil, errors.New("unexpected Start call")
	}
	return s.start(ctx, enterpriseID, id, retry)
}
func (*keywordDistillationRepoStub) Complete(context.Context, *KeywordDistillationTask, *KeywordDistillationResult) (*KeywordDistillationTask, error) {
	return nil, errors.New("unexpected Complete call")
}
func (s *keywordDistillationRepoStub) Fail(ctx context.Context, enterpriseID, id uint64, code, message string) (*KeywordDistillationTask, error) {
	if s.fail == nil {
		return nil, errors.New("unexpected Fail call")
	}
	return s.fail(ctx, enterpriseID, id, code, message)
}

type keywordDistillerStub struct {
	result *KeywordDistillationResult
	err    error
}

func (s keywordDistillerStub) Generate(context.Context, *KeywordDistillationTask) (*KeywordDistillationResult, error) {
	return s.result, s.err
}
