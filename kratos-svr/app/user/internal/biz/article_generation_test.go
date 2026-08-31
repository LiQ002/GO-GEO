package biz

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestArticleGenerationUsecasePersistsModelFailure(t *testing.T) {
	t.Parallel()

	repo := &articleGenerationRepoStub{
		create: func(_ context.Context, input ArticleGenerationInput) (*ArticleGenerationTask, bool, error) {
			return &ArticleGenerationTask{ID: 10, EnterpriseID: input.EnterpriseID, Status: "pending"}, true, nil
		},
		start: func(_ context.Context, enterpriseID, id uint64, retry bool) (*ArticleGenerationTask, error) {
			if retry {
				t.Fatal("new task must not start as retry")
			}
			return &ArticleGenerationTask{ID: id, EnterpriseID: enterpriseID, Status: "running"}, nil
		},
		fail: func(_ context.Context, enterpriseID, id uint64, code, message string) (*ArticleGenerationTask, error) {
			if code != "MODEL_CALL_FAILED" || message != "provider unavailable" {
				t.Fatalf("failure = %s %q", code, message)
			}
			return &ArticleGenerationTask{ID: id, EnterpriseID: enterpriseID, Status: "failed", ErrorCode: code}, nil
		},
	}
	usecase := NewArticleGenerationUsecase(repo, articleGeneratorStub{err: errors.New("provider unavailable")})
	task, err := usecase.execute(context.Background(), &ArticleGenerationTask{ID: 10, EnterpriseID: 1, Status: "pending"}, false)
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if task.Status != "failed" || task.ErrorCode != "MODEL_CALL_FAILED" {
		t.Fatalf("task = %#v", task)
	}
}

func TestArticleGenerationUsecaseReturnsIdempotentTask(t *testing.T) {
	t.Parallel()

	repo := &articleGenerationRepoStub{
		create: func(_ context.Context, input ArticleGenerationInput) (*ArticleGenerationTask, bool, error) {
			return &ArticleGenerationTask{ID: 10, EnterpriseID: input.EnterpriseID, Status: "completed"}, false, nil
		},
	}
	generator := &articleGeneratorCallStub{}
	usecase := NewArticleGenerationUsecase(repo, generator)
	task, err := usecase.Create(context.Background(), validArticleGenerationInput())
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if task.Status != "completed" || generator.called {
		t.Fatalf("task = %#v, generator called = %v", task, generator.called)
	}
}

func TestArticleGenerationUsecaseRejectsInvalidInput(t *testing.T) {
	t.Parallel()

	usecase := NewArticleGenerationUsecase(&articleGenerationRepoStub{}, &articleGeneratorCallStub{})
	input := validArticleGenerationInput()
	input.KnowledgeDocumentIDs = []uint64{8, 8}
	_, err := usecase.Create(context.Background(), input)
	if !errors.Is(err, ErrArticleGenerationInvalid) {
		t.Fatalf("Create() error = %v, want %v", err, ErrArticleGenerationInvalid)
	}
}

func TestArticleGenerationUsecaseRejectsImageCountWithoutAlbum(t *testing.T) {
	t.Parallel()

	usecase := NewArticleGenerationUsecase(&articleGenerationRepoStub{}, &articleGeneratorCallStub{})
	input := validArticleGenerationInput()
	input.GalleryImageCount = 3
	_, err := usecase.Create(context.Background(), input)
	if !errors.Is(err, ErrArticleGenerationInvalid) {
		t.Fatalf("Create() error = %v, want %v", err, ErrArticleGenerationInvalid)
	}
}

func TestArticleGenerationUsecaseRequiresKnowledgeSelection(t *testing.T) {
	t.Parallel()

	usecase := NewArticleGenerationUsecase(&articleGenerationRepoStub{}, &articleGeneratorCallStub{})
	input := validArticleGenerationInput()
	input.KnowledgeDocumentIDs = nil
	input.KnowledgeBaseIDs = nil
	_, err := usecase.Create(context.Background(), input)
	if !errors.Is(err, ErrArticleGenerationInvalid) {
		t.Fatalf("Create() error = %v, want %v", err, ErrArticleGenerationInvalid)
	}
}

func TestArticleGenerationUsecaseRejectsMixedKnowledgeSelection(t *testing.T) {
	t.Parallel()

	usecase := NewArticleGenerationUsecase(&articleGenerationRepoStub{}, &articleGeneratorCallStub{})
	input := validArticleGenerationInput()
	input.KnowledgeBaseIDs = []uint64{9}
	_, err := usecase.Create(context.Background(), input)
	if !errors.Is(err, ErrArticleGenerationInvalid) {
		t.Fatalf("Create() error = %v, want %v", err, ErrArticleGenerationInvalid)
	}
}

func TestApplyArticleGalleryImagesUsesPlaceholdersAndFallback(t *testing.T) {
	t.Parallel()

	refsJSON := `[
		{"image_id":1,"original_name":"封面图.png","url":"https://cdn.example.com/cover.png","placeholder":"","placement":1},
		{"image_id":2,"original_name":"产品图.png","url":"https://cdn.example.com/1.png","placeholder":"[[GALLERY_IMAGE_1]]","placement":2},
		{"image_id":3,"original_name":"场景图.jpg","url":"https://cdn.example.com/2.jpg","placeholder":"[[GALLERY_IMAGE_2]]","placement":2}
	]`
	content := "# 标题\n\n第一段正文。\n\n[[GALLERY_IMAGE_1]]\n\n第二段正文。\n\n[[GALLERY_IMAGE_2]]\n\n第三段正文。"
	got, err := applyArticleGalleryImages(content, refsJSON)
	if err != nil {
		t.Fatal(err)
	}
	for _, expected := range []string{
		"![产品图](https://cdn.example.com/1.png)",
		"![场景图](https://cdn.example.com/2.jpg)",
	} {
		if strings.Count(got, expected) != 1 {
			t.Fatalf("rendered article does not contain exactly one %q: %s", expected, got)
		}
	}
	if strings.Contains(got, "[[GALLERY_IMAGE_") {
		t.Fatalf("rendered article still contains placeholders: %s", got)
	}
	if strings.Contains(got, "cover.png") {
		t.Fatalf("cover image must not be inserted into article body: %s", got)
	}
}

func TestNormalizeArticleGenerationGalleryRefsUsesFirstImageAsLegacyCover(t *testing.T) {
	t.Parallel()

	refs := NormalizeArticleGenerationGalleryRefs([]ArticleGenerationGalleryRef{
		{ImageID: 1, Placeholder: "[[GALLERY_IMAGE_1]]"},
		{ImageID: 2, Placeholder: "[[GALLERY_IMAGE_2]]"},
	})
	if refs[0].Placement != ArticleGalleryPlacementCover || refs[1].Placement != ArticleGalleryPlacementBody {
		t.Fatalf("normalized placements = %d, %d", refs[0].Placement, refs[1].Placement)
	}
}

func validArticleGenerationInput() ArticleGenerationInput {
	return ArticleGenerationInput{
		EnterpriseID:         1,
		OperatorID:           2,
		ClientRequestID:      "request-1",
		BrandID:              3,
		ArticleTypeVersionID: 4,
		WritingModelID:       5,
		KnowledgeDocumentIDs: []uint64{8},
		InputJSON:            `{"topic":"GEO"}`,
	}
}

type articleGenerationRepoStub struct {
	create func(context.Context, ArticleGenerationInput) (*ArticleGenerationTask, bool, error)
	start  func(context.Context, uint64, uint64, bool) (*ArticleGenerationTask, error)
	fail   func(context.Context, uint64, uint64, string, string) (*ArticleGenerationTask, error)
}

func (s *articleGenerationRepoStub) Create(ctx context.Context, input ArticleGenerationInput) (*ArticleGenerationTask, bool, error) {
	if s.create == nil {
		return nil, false, errors.New("unexpected Create call")
	}
	return s.create(ctx, input)
}

func (*articleGenerationRepoStub) Get(context.Context, uint64, uint64) (*ArticleGenerationTask, error) {
	return nil, errors.New("unexpected Get call")
}

func (*articleGenerationRepoStub) List(context.Context, uint64, ArticleGenerationListOptions) ([]*ArticleGenerationTask, int64, error) {
	return nil, 0, errors.New("unexpected List call")
}

func (s *articleGenerationRepoStub) Start(ctx context.Context, enterpriseID, id uint64, retry bool) (*ArticleGenerationTask, error) {
	if s.start == nil {
		return nil, errors.New("unexpected Start call")
	}
	return s.start(ctx, enterpriseID, id, retry)
}

func (*articleGenerationRepoStub) Complete(context.Context, *ArticleGenerationTask, *ArticleGenerationResult) (*ArticleGenerationTask, error) {
	return nil, errors.New("unexpected Complete call")
}

func (s *articleGenerationRepoStub) Fail(ctx context.Context, enterpriseID, id uint64, code, message string) (*ArticleGenerationTask, error) {
	if s.fail == nil {
		return nil, errors.New("unexpected Fail call")
	}
	return s.fail(ctx, enterpriseID, id, code, message)
}

type articleGeneratorStub struct {
	err error
}

func (s articleGeneratorStub) Generate(context.Context, *ArticleGenerationTask) (*ArticleGenerationResult, error) {
	return nil, s.err
}

type articleGeneratorCallStub struct {
	called bool
}

func (s *articleGeneratorCallStub) Generate(context.Context, *ArticleGenerationTask) (*ArticleGenerationResult, error) {
	s.called = true
	return nil, errors.New("unexpected Generate call")
}
