package biz

import (
	"context"
	"encoding/json"
	"fmt"
	"path"
	"strings"
	"time"

	"github.com/go-kratos/kratos/v3/errors"
)

var (
	ErrArticleGenerationNotFound  = errors.NotFound("ARTICLE_GENERATION_NOT_FOUND", "article generation task not found")
	ErrArticleGenerationInvalid   = errors.BadRequest("ARTICLE_GENERATION_INVALID", "invalid article generation request")
	ErrArticleGenerationConflict  = errors.Conflict("ARTICLE_GENERATION_CONFLICT", "article generation task conflict")
	ErrArticleGenerationState     = errors.Conflict("ARTICLE_GENERATION_STATE_INVALID", "article generation task state does not allow this operation")
	ErrArticleGenerationModel     = errors.BadRequest("ARTICLE_GENERATION_MODEL_UNAVAILABLE", "writing model is not available to this enterprise")
	ErrArticleGenerationKnowledge = errors.BadRequest("ARTICLE_GENERATION_KNOWLEDGE_INVALID", "selected knowledge base does not contain parsed content")
	ErrArticleGenerationGallery   = errors.BadRequest("ARTICLE_GENERATION_GALLERY_INVALID", "selected gallery does not contain enough available images")
)

const (
	MaxArticleGenerationKnowledgeBases     = 20
	MaxArticleGenerationKnowledgeDocuments = 100
	MaxArticleGenerationGalleryAlbums      = 20
	MaxArticleGenerationGalleryImages      = 20
	ArticleGalleryPlacementCover           = 1
	ArticleGalleryPlacementBody            = 2
)

type ArticleGenerationTask struct {
	ID                     uint64
	EnterpriseID           uint64
	ArticleID              uint64
	ArticleTypeVersionID   uint64
	PromptVersionID        uint64
	WritingModelID         uint64
	WritingModelVersion    uint64
	ClientRequestID        string
	Status                 string
	InputJSON              string
	PromptSnapshot         string
	ModelSnapshotJSON      string
	KnowledgeRefsJSON      string
	GalleryRefsJSON        string
	OutputJSON             string
	InputTokens            uint64
	OutputTokens           uint64
	CostMicros             int64
	ErrorCode              string
	ErrorMessage           string
	AttemptCount           uint32
	ResultArticleVersionID uint64
	ResultSnapshotID       uint64
	StartedAt              *time.Time
	CompletedAt            *time.Time
	CreatedAt              time.Time
	UpdatedAt              time.Time
}

type ArticleGenerationInput struct {
	EnterpriseID         uint64
	OperatorID           uint64
	ClientRequestID      string
	ArticleID            uint64
	BrandID              uint64
	ArticleTypeID        uint64
	ArticleTypeVersionID uint64
	WritingModelID       uint64
	KeywordID            uint64
	QuestionID           uint64
	KnowledgeBaseIDs     []uint64
	KnowledgeDocumentIDs []uint64
	GalleryAlbumIDs      []uint64
	GalleryImageCount    uint32
	InputJSON            string
	UserInstruction      string
}

// ArticleGenerationGalleryRef freezes one randomly selected gallery image.
type ArticleGenerationGalleryRef struct {
	ImageID      uint64 `json:"image_id"`
	AlbumID      uint64 `json:"album_id"`
	AlbumName    string `json:"album_name"`
	Category     int32  `json:"category"`
	OriginalName string `json:"original_name"`
	ObjectKey    string `json:"object_key"`
	URL          string `json:"url"`
	Placeholder  string `json:"placeholder"`
	Placement    int32  `json:"placement"`
}

type ArticleGenerationListOptions struct {
	Offset    int
	Limit     int
	Status    string
	ArticleID uint64
}

type ArticleGenerationResult struct {
	Title           string `json:"title"`
	Summary         string `json:"summary"`
	ContentMarkdown string `json:"content_markdown"`
	RawContent      string `json:"raw_content,omitempty"`
	InputTokens     uint64 `json:"-"`
	OutputTokens    uint64 `json:"-"`
	CostMicros      int64  `json:"-"`
}

type ArticleGenerationRepo interface {
	Create(context.Context, ArticleGenerationInput) (*ArticleGenerationTask, bool, error)
	Get(context.Context, uint64, uint64) (*ArticleGenerationTask, error)
	List(context.Context, uint64, ArticleGenerationListOptions) ([]*ArticleGenerationTask, int64, error)
	Start(context.Context, uint64, uint64, bool) (*ArticleGenerationTask, error)
	Complete(context.Context, *ArticleGenerationTask, *ArticleGenerationResult) (*ArticleGenerationTask, error)
	Fail(context.Context, uint64, uint64, string, string) (*ArticleGenerationTask, error)
}

type ArticleGenerator interface {
	Generate(context.Context, *ArticleGenerationTask) (*ArticleGenerationResult, error)
}

type ArticleGenerationUsecase struct {
	repo      ArticleGenerationRepo
	generator ArticleGenerator
}

func NewArticleGenerationUsecase(repo ArticleGenerationRepo, generator ArticleGenerator) *ArticleGenerationUsecase {
	return &ArticleGenerationUsecase{repo: repo, generator: generator}
}

func (u *ArticleGenerationUsecase) Create(ctx context.Context, input ArticleGenerationInput) (*ArticleGenerationTask, error) {
	if err := validateArticleGenerationInput(input); err != nil {
		return nil, err
	}
	task, created, err := u.repo.Create(ctx, input)
	if err != nil {
		return nil, err
	}
	if !created {
		return task, nil
	}
	go u.runGenerationInBackground(task, false)
	return task, nil
}

func (u *ArticleGenerationUsecase) runGenerationInBackground(task *ArticleGenerationTask, retry bool) {
	defer func() {
		if recovered := recover(); recovered != nil {
			_, _ = u.repo.Fail(context.Background(), task.EnterpriseID, task.ID, "PANIC", fmt.Sprintf("%v", recovered))
		}
	}()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	_, _ = u.execute(ctx, task, retry)
}

func (u *ArticleGenerationUsecase) Get(ctx context.Context, enterpriseID, id uint64) (*ArticleGenerationTask, error) {
	if enterpriseID == 0 || id == 0 {
		return nil, ErrArticleGenerationInvalid
	}
	return u.repo.Get(ctx, enterpriseID, id)
}

func (u *ArticleGenerationUsecase) List(ctx context.Context, enterpriseID uint64, opts ArticleGenerationListOptions) ([]*ArticleGenerationTask, int64, error) {
	if enterpriseID == 0 {
		return nil, 0, ErrArticleGenerationInvalid
	}
	return u.repo.List(ctx, enterpriseID, opts)
}

func (u *ArticleGenerationUsecase) Retry(ctx context.Context, enterpriseID, id uint64) (*ArticleGenerationTask, error) {
	if enterpriseID == 0 || id == 0 {
		return nil, ErrArticleGenerationInvalid
	}
	task, err := u.repo.Get(ctx, enterpriseID, id)
	if err != nil {
		return nil, err
	}
	if task.Status != "failed" {
		return nil, ErrArticleGenerationState
	}
	go u.runGenerationInBackground(task, true)
	return task, nil
}

func (u *ArticleGenerationUsecase) execute(ctx context.Context, task *ArticleGenerationTask, retry bool) (*ArticleGenerationTask, error) {
	running, err := u.repo.Start(ctx, task.EnterpriseID, task.ID, retry)
	if err != nil {
		return nil, err
	}
	result, err := u.generator.Generate(ctx, running)
	if err != nil {
		message := strings.TrimSpace(err.Error())
		if len([]rune(message)) > 2000 {
			message = string([]rune(message)[:2000])
		}
		return u.repo.Fail(ctx, running.EnterpriseID, running.ID, "MODEL_CALL_FAILED", message)
	}
	if result == nil || strings.TrimSpace(result.ContentMarkdown) == "" {
		return u.repo.Fail(ctx, running.EnterpriseID, running.ID, "MODEL_EMPTY_OUTPUT", "writing model returned empty article content")
	}
	content, err := applyArticleGalleryImages(result.ContentMarkdown, running.GalleryRefsJSON)
	if err != nil {
		return u.repo.Fail(ctx, running.EnterpriseID, running.ID, "GALLERY_IMAGE_INSERT_FAILED", err.Error())
	}
	result.ContentMarkdown = content
	return u.repo.Complete(ctx, running, result)
}

func validateArticleGenerationInput(input ArticleGenerationInput) error {
	if input.EnterpriseID == 0 || input.OperatorID == 0 || input.BrandID == 0 || (input.ArticleTypeID == 0 && input.ArticleTypeVersionID == 0) || (input.QuestionID != 0 && input.KeywordID == 0) {
		return ErrArticleGenerationInvalid
	}
	requestID := strings.TrimSpace(input.ClientRequestID)
	if requestID == "" || len(requestID) > 128 || len([]rune(input.UserInstruction)) > 4000 {
		return ErrArticleGenerationInvalid
	}
	if !json.Valid([]byte(input.InputJSON)) {
		return ErrArticleGenerationInvalid
	}
	var values map[string]any
	if err := json.Unmarshal([]byte(input.InputJSON), &values); err != nil || values == nil {
		return ErrArticleGenerationInvalid
	}
	if (len(input.KnowledgeBaseIDs) == 0 && len(input.KnowledgeDocumentIDs) == 0) ||
		(len(input.KnowledgeBaseIDs) > 0 && len(input.KnowledgeDocumentIDs) > 0) ||
		len(input.KnowledgeBaseIDs) > MaxArticleGenerationKnowledgeBases ||
		len(input.KnowledgeDocumentIDs) > MaxArticleGenerationKnowledgeDocuments ||
		len(input.GalleryAlbumIDs) > MaxArticleGenerationGalleryAlbums ||
		input.GalleryImageCount > MaxArticleGenerationGalleryImages ||
		(input.GalleryImageCount > 0 && len(input.GalleryAlbumIDs) == 0) {
		return ErrArticleGenerationInvalid
	}
	if !uniqueNonZeroIDs(input.KnowledgeBaseIDs) ||
		!uniqueNonZeroIDs(input.KnowledgeDocumentIDs) ||
		!uniqueNonZeroIDs(input.GalleryAlbumIDs) {
		return ErrArticleGenerationInvalid
	}
	return nil
}

func uniqueNonZeroIDs(ids []uint64) bool {
	seen := make(map[uint64]struct{}, len(ids))
	for _, id := range ids {
		if id == 0 {
			return false
		}
		if _, exists := seen[id]; exists {
			return false
		}
		seen[id] = struct{}{}
	}
	return true
}

func applyArticleGalleryImages(content, refsJSON string) (string, error) {
	if strings.TrimSpace(refsJSON) == "" {
		return strings.TrimSpace(content), nil
	}
	var refs []ArticleGenerationGalleryRef
	if err := json.Unmarshal([]byte(refsJSON), &refs); err != nil {
		return "", fmt.Errorf("invalid gallery image snapshot")
	}
	if len(refs) == 0 {
		return strings.TrimSpace(content), nil
	}
	refs = NormalizeArticleGenerationGalleryRefs(refs)
	rendered := strings.TrimSpace(content)
	missing := make([]string, 0, len(refs))
	for _, ref := range refs {
		if ref.Placement == ArticleGalleryPlacementCover {
			if strings.TrimSpace(ref.Placeholder) != "" {
				rendered = strings.ReplaceAll(rendered, ref.Placeholder, "")
			}
			continue
		}
		if strings.TrimSpace(ref.Placeholder) == "" || strings.TrimSpace(ref.URL) == "" {
			return "", fmt.Errorf("incomplete gallery image snapshot")
		}
		markdown := fmt.Sprintf("![%s](%s)", markdownImageAlt(ref.OriginalName), strings.TrimSpace(ref.URL))
		if strings.Contains(rendered, ref.Placeholder) {
			rendered = strings.Replace(rendered, ref.Placeholder, markdown, 1)
			rendered = strings.ReplaceAll(rendered, ref.Placeholder, "")
			continue
		}
		missing = append(missing, markdown)
	}
	if len(missing) > 0 {
		rendered = insertMarkdownImages(rendered, missing)
	}
	return strings.TrimSpace(rendered), nil
}

// NormalizeArticleGenerationGalleryRefs guarantees exactly one cover when at
// least one image was selected. Legacy snapshots without placement metadata use
// the first selected image as cover and the remaining images as body images.
func NormalizeArticleGenerationGalleryRefs(refs []ArticleGenerationGalleryRef) []ArticleGenerationGalleryRef {
	normalized := append([]ArticleGenerationGalleryRef(nil), refs...)
	if len(normalized) == 0 {
		return normalized
	}
	coverIndex := -1
	for index := range normalized {
		if normalized[index].Placement == ArticleGalleryPlacementCover && coverIndex == -1 {
			coverIndex = index
		}
	}
	if coverIndex == -1 {
		coverIndex = 0
	}
	for index := range normalized {
		if index == coverIndex {
			normalized[index].Placement = ArticleGalleryPlacementCover
			continue
		}
		normalized[index].Placement = ArticleGalleryPlacementBody
	}
	return normalized
}

func markdownImageAlt(value string) string {
	value = strings.TrimSpace(value)
	value = strings.TrimSuffix(value, path.Ext(value))
	value = strings.NewReplacer("[", "［", "]", "］", "\n", " ").Replace(value)
	if value == "" {
		return "文章配图"
	}
	return value
}

func insertMarkdownImages(content string, images []string) string {
	blocks := strings.Split(strings.TrimSpace(content), "\n\n")
	candidates := make([]int, 0, len(blocks))
	inFence := false
	for index, block := range blocks {
		trimmed := strings.TrimSpace(block)
		if strings.Count(trimmed, "```")%2 == 1 {
			inFence = !inFence
		}
		if inFence || trimmed == "" || strings.HasPrefix(trimmed, "```") ||
			strings.HasPrefix(trimmed, "#") ||
			strings.HasPrefix(trimmed, "![") || strings.HasPrefix(trimmed, "|") {
			continue
		}
		candidates = append(candidates, index)
	}
	if len(candidates) == 0 {
		candidates = append(candidates, max(len(blocks)-1, 0))
	}
	after := make(map[int][]string, len(images))
	for index, image := range images {
		position := candidates[(index+1)*len(candidates)/(len(images)+1)]
		after[position] = append(after[position], image)
	}
	output := make([]string, 0, len(blocks)+len(images))
	for index, block := range blocks {
		output = append(output, block)
		output = append(output, after[index]...)
	}
	return strings.Join(output, "\n\n")
}
