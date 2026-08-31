package biz

import "context"

type CatalogItem struct {
	ID, CurrentVersionID, ParentID                                                         uint64
	Code, LoginURL, Name, Category, Description, Icon, CapabilitiesJSON, DisplayConfigJSON string
	DriverType                                                                             int32
	AccountRequired                                                                        bool
}

type ArticleTypeSection struct {
	Title, Guidance string
	Required        bool
}

type ArticleTypeInputField struct {
	Key, Label, Placeholder, HelpText, DefaultValue string
	InputType                                       int32
	Required                                        bool
	Options                                         []string
}

type ArticleTypeConfig struct {
	ContentGoal, TargetAudience, Tone        string
	RecommendedMinWords, RecommendedMaxWords uint32
	OutputFormat                             int32
	Sections                                 []ArticleTypeSection
	InputFields                              []ArticleTypeInputField
	WritingModelIDs, PublishChannelIDs       []uint64
	DefaultWritingModelID                    uint64
}

type ArticleTypeCatalogItem struct {
	ID, CurrentVersionID          uint64
	ConfigRevision                uint32
	Code, Name, Description, Icon string
	Config                        *ArticleTypeConfig
}

type CatalogRepo interface {
	ListArticleTypes(context.Context, uint64) ([]*ArticleTypeCatalogItem, error)
	ListWritingModels(context.Context, uint64) ([]*CatalogItem, error)
	ListPublishChannels(context.Context, uint64) ([]*CatalogItem, error)
	ListPublishTargets(context.Context, uint64, uint64) ([]*CatalogItem, error)
	ListInclusionSites(context.Context, uint64) ([]*CatalogItem, error)
}
type CatalogUsecase struct{ repo CatalogRepo }

func NewCatalogUsecase(r CatalogRepo) *CatalogUsecase { return &CatalogUsecase{repo: r} }
func (u *CatalogUsecase) ListArticleTypes(c context.Context, e uint64) ([]*ArticleTypeCatalogItem, error) {
	return u.repo.ListArticleTypes(c, e)
}
func (u *CatalogUsecase) ListWritingModels(c context.Context, e uint64) ([]*CatalogItem, error) {
	return u.repo.ListWritingModels(c, e)
}
func (u *CatalogUsecase) ListPublishChannels(c context.Context, e uint64) ([]*CatalogItem, error) {
	return u.repo.ListPublishChannels(c, e)
}
func (u *CatalogUsecase) ListPublishTargets(c context.Context, e, channelID uint64) ([]*CatalogItem, error) {
	return u.repo.ListPublishTargets(c, e, channelID)
}
func (u *CatalogUsecase) ListInclusionSites(c context.Context, e uint64) ([]*CatalogItem, error) {
	return u.repo.ListInclusionSites(c, e)
}
