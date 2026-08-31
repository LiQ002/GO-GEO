package biz

import (
	"bytes"
	"context"
	"encoding/json"
	"regexp"
	"strings"
	"text/template"
	"time"

	"github.com/go-kratos/kratos/v3/errors"
)

var (
	ErrArticleTypeNotFound = errors.NotFound("ARTICLE_TYPE_NOT_FOUND", "article type not found")
	ErrArticleTypeInvalid  = errors.BadRequest("ARTICLE_TYPE_INVALID", "invalid article type")
	ErrArticleTypeConflict = errors.Conflict("ARTICLE_TYPE_CONFLICT", "article type version conflict")
)

// ArticleType is the article template identity exposed to platform operators.
type ArticleType struct {
	ID                  uint64
	Code                string
	Name                string
	Description         string
	Icon                string
	SourceType          int32
	Status              int32
	Visible             bool
	SortOrder           int32
	CurrentVersionID    uint64
	VisibilityJSON      string
	Version             uint64
	ConfigRevision      uint32
	ConfigChangeSummary string
	Config              *ArticleTypeConfig
	PublishedBy         uint64
	CreatedAt           time.Time
	UpdatedAt           time.Time
}

// ArticleTypeSection defines one ordered article section.
type ArticleTypeSection struct {
	Title    string
	Guidance string
	Required bool
}

// ArticleTypeInputField defines one enterprise-provided prompt variable.
type ArticleTypeInputField struct {
	Key          string
	Label        string
	InputType    int32
	Required     bool
	Placeholder  string
	HelpText     string
	Options      []string
	DefaultValue string
}

// ArticleTypeConfig is the operator-facing generation configuration.
type ArticleTypeConfig struct {
	ContentGoal           string
	TargetAudience        string
	Tone                  string
	RecommendedMinWords   uint32
	RecommendedMaxWords   uint32
	Sections              []ArticleTypeSection
	InputFields           []ArticleTypeInputField
	GEORules              []string
	QualityRules          []string
	SystemPrompt          string
	UserPromptTemplate    string
	OutputFormat          int32
	WritingModelIDs       []uint64
	DefaultWritingModelID uint64
	PublishChannelIDs     []uint64
}

// ArticleTypeVersion is an immutable generation configuration.
type ArticleTypeVersion struct {
	ID                   uint64
	ArticleTypeID        uint64
	VersionNumber        uint32
	Status               int32
	ContentGoal          string
	TargetAudience       string
	Tone                 string
	RecommendedMinWords  uint32
	RecommendedMaxWords  uint32
	StructureJSON        string
	InputSchemaJSON      string
	GEORulesJSON         string
	QualityRulesJSON     string
	PromptVersionID      uint64
	DefaultModelID       uint64
	FallbackModelIDsJSON string
	ChangeSummary        string
	PublishedBy          uint64
	Config               *ArticleTypeConfig
	CreatedAt            time.Time
}

// ArticleTypeListOptions defines safe catalog filters.
type ArticleTypeListOptions struct {
	Offset     int
	Limit      int
	Status     int32
	SourceType int32
	Keyword    string
	Visible    *bool
}

// ArticleTypeRepo is implemented by the admin data layer.
type ArticleTypeRepo interface {
	Create(context.Context, *ArticleType) (*ArticleType, error)
	Get(context.Context, uint64) (*ArticleType, error)
	List(context.Context, ArticleTypeListOptions) ([]*ArticleType, int64, error)
	Update(context.Context, *ArticleType) (*ArticleType, error)
	Delete(context.Context, uint64, uint64) error
	CreateVersion(context.Context, *ArticleTypeVersion) (*ArticleTypeVersion, error)
	ListVersions(context.Context, uint64) ([]*ArticleTypeVersion, error)
	SetCurrentVersion(context.Context, uint64, uint64, uint64) (*ArticleType, error)
}

// ArticleTypeUsecase enforces system preset and immutable-version rules.
type ArticleTypeUsecase struct{ repo ArticleTypeRepo }

func NewArticleTypeUsecase(repo ArticleTypeRepo) *ArticleTypeUsecase {
	return &ArticleTypeUsecase{repo: repo}
}

func (uc *ArticleTypeUsecase) Create(ctx context.Context, item *ArticleType) (*ArticleType, error) {
	if item == nil || strings.TrimSpace(item.Code) == "" || strings.TrimSpace(item.Name) == "" {
		return nil, ErrArticleTypeInvalid
	}
	item.SourceType = ArticleTypeSourceCustom
	if item.Status == 0 {
		item.Status = ArticleTypeStatusDraft
	}
	if !inRange(item.Status, ArticleTypeStatusDraft, ArticleTypeStatusArchived) || !validJSON(item.VisibilityJSON, true) || validateArticleTypeConfig(item.Config) != nil {
		return nil, ErrArticleTypeInvalid
	}
	return uc.repo.Create(ctx, item)
}

func (uc *ArticleTypeUsecase) Get(ctx context.Context, id uint64) (*ArticleType, error) {
	if id == 0 {
		return nil, ErrArticleTypeInvalid
	}
	return uc.repo.Get(ctx, id)
}

func (uc *ArticleTypeUsecase) List(ctx context.Context, opts ArticleTypeListOptions) ([]*ArticleType, int64, error) {
	return uc.repo.List(ctx, opts)
}

func (uc *ArticleTypeUsecase) Update(ctx context.Context, item *ArticleType) (*ArticleType, error) {
	if item == nil || item.ID == 0 || item.Version == 0 || strings.TrimSpace(item.Name) == "" {
		return nil, ErrArticleTypeInvalid
	}
	current, err := uc.repo.Get(ctx, item.ID)
	if err != nil {
		return nil, err
	}
	if validateArticleTypeConfig(item.Config) != nil || !validJSON(item.VisibilityJSON, true) || !inRange(item.Status, ArticleTypeStatusDraft, ArticleTypeStatusArchived) {
		return nil, ErrArticleTypeInvalid
	}
	item.Code = current.Code
	item.SourceType = current.SourceType
	item.CurrentVersionID = current.CurrentVersionID
	return uc.repo.Update(ctx, item)
}

func (uc *ArticleTypeUsecase) Delete(ctx context.Context, id, version uint64) error {
	if id == 0 || version == 0 {
		return ErrArticleTypeConflict
	}
	return uc.repo.Delete(ctx, id, version)
}

func (uc *ArticleTypeUsecase) CreateVersion(ctx context.Context, version *ArticleTypeVersion) (*ArticleTypeVersion, error) {
	if version == nil || version.ArticleTypeID == 0 || validateArticleTypeConfig(version.Config) != nil {
		return nil, ErrArticleTypeInvalid
	}
	version.Status = ArticleTypeVersionStatusDraft
	return uc.repo.CreateVersion(ctx, version)
}

func (uc *ArticleTypeUsecase) ListVersions(ctx context.Context, articleTypeID uint64) ([]*ArticleTypeVersion, error) {
	if articleTypeID == 0 {
		return nil, ErrArticleTypeInvalid
	}
	return uc.repo.ListVersions(ctx, articleTypeID)
}

func (uc *ArticleTypeUsecase) SetCurrentVersion(ctx context.Context, articleTypeID, versionID, expectedVersion uint64) (*ArticleType, error) {
	if articleTypeID == 0 || versionID == 0 || expectedVersion == 0 {
		return nil, ErrArticleTypeInvalid
	}
	return uc.repo.SetCurrentVersion(ctx, articleTypeID, versionID, expectedVersion)
}

func validJSON(value string, allowEmpty bool) bool {
	if strings.TrimSpace(value) == "" {
		return allowEmpty
	}
	return json.Valid([]byte(value))
}

var articleTypeInputKeyPattern = regexp.MustCompile(`^[a-z][a-z0-9_]{0,63}$`)

func validateArticleTypeConfig(config *ArticleTypeConfig) error {
	if config == nil || strings.TrimSpace(config.ContentGoal) == "" || strings.TrimSpace(config.SystemPrompt) == "" || strings.TrimSpace(config.UserPromptTemplate) == "" {
		return ErrArticleTypeInvalid
	}
	if config.RecommendedMaxWords > 0 && config.RecommendedMinWords > config.RecommendedMaxWords {
		return ErrArticleTypeInvalid
	}
	if config.OutputFormat == 0 {
		config.OutputFormat = 1
	}
	if config.OutputFormat != 1 || len(config.Sections) == 0 {
		return ErrArticleTypeInvalid
	}
	for _, section := range config.Sections {
		if strings.TrimSpace(section.Title) == "" {
			return ErrArticleTypeInvalid
		}
	}
	inputKeys := make(map[string]struct{}, len(config.InputFields))
	templateValues := map[string]any{
		"brand_name": "brand", "brand_description": "description", "brand_industry": "industry",
		"brand_target_audience": "audience", "brand_core_value": "value", "knowledge_context": "knowledge",
		"user_instruction": "instruction", "distilled_questions": []string{},
	}
	for _, field := range config.InputFields {
		key := strings.TrimSpace(field.Key)
		if !articleTypeInputKeyPattern.MatchString(key) || strings.TrimSpace(field.Label) == "" || field.InputType < 1 || field.InputType > 5 {
			return ErrArticleTypeInvalid
		}
		if _, exists := inputKeys[key]; exists {
			return ErrArticleTypeInvalid
		}
		inputKeys[key] = struct{}{}
		if field.InputType == 5 {
			templateValues[key] = []string{"value"}
		} else {
			templateValues[key] = "value"
		}
		if (field.InputType == 4 || field.InputType == 5) && len(field.Options) == 0 {
			return ErrArticleTypeInvalid
		}
		optionValues := make(map[string]struct{}, len(field.Options))
		for _, option := range field.Options {
			value := strings.TrimSpace(option)
			if value == "" {
				return ErrArticleTypeInvalid
			}
			if _, exists := optionValues[value]; exists {
				return ErrArticleTypeInvalid
			}
			optionValues[value] = struct{}{}
		}
	}
	parsed, err := template.New("article_type").Option("missingkey=error").Parse(config.UserPromptTemplate)
	if err != nil {
		return ErrArticleTypeInvalid
	}
	if err := parsed.Execute(&bytes.Buffer{}, templateValues); err != nil {
		return ErrArticleTypeInvalid
	}
	for _, rule := range append(append([]string(nil), config.GEORules...), config.QualityRules...) {
		if strings.TrimSpace(rule) == "" {
			return ErrArticleTypeInvalid
		}
	}
	if !validIDList(config.WritingModelIDs) || !validIDList(config.PublishChannelIDs) {
		return ErrArticleTypeInvalid
	}
	if config.DefaultWritingModelID != 0 {
		found := false
		for _, id := range config.WritingModelIDs {
			found = found || id == config.DefaultWritingModelID
		}
		if !found {
			return ErrArticleTypeInvalid
		}
	}
	return nil
}

func validIDList(ids []uint64) bool {
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
