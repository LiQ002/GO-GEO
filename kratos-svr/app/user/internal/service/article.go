package service

import (
	"context"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"
	v1 "kratos-svr/api/user/v1"
	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/authn"
	"kratos-svr/internal/query"
)

type ArticleService struct {
	v1.UnimplementedArticleServiceServer
	uc *biz.ArticleUsecase
}

func NewArticleService(u *biz.ArticleUsecase) *ArticleService { return &ArticleService{uc: u} }
func (s *ArticleService) CreateArticle(c context.Context, r *v1.CreateArticleRequest) (*v1.Article, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	i := articleDO(r.GetArticle())
	if i != nil {
		i.EnterpriseID = e
	}
	o, x := s.uc.Create(c, i)
	if x != nil {
		return nil, x
	}
	return articleDTO(o), nil
}
func (s *ArticleService) GetArticle(c context.Context, r *v1.GetArticleRequest) (*v1.Article, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	o, x := s.uc.Get(c, e, r.GetId())
	if x != nil {
		return nil, x
	}
	return articleDTO(o), nil
}
func (s *ArticleService) ListArticles(c context.Context, r *v1.ListArticlesRequest) (*v1.ListArticlesReply, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	p, x := parseUserPage(r.GetPageSize(), r.GetPageToken())
	if x != nil {
		return nil, biz.ErrArticleInvalid
	}
	items, total, x := s.uc.List(c, e, biz.ArticleListOptions{Offset: p.Offset, Limit: p.Limit, BrandID: r.GetBrandId(), Status: r.GetStatus(), Keyword: r.GetKeyword()})
	if x != nil {
		return nil, x
	}
	o := &v1.ListArticlesReply{Items: make([]*v1.Article, 0, len(items)), TotalSize: total}
	for _, i := range items {
		o.Items = append(o.Items, articleDTO(i))
	}
	if p.Offset+len(items) < int(total) {
		o.NextPageToken = query.NextToken(p.Offset + len(items))
	}
	return o, nil
}
func (s *ArticleService) UpdateArticle(c context.Context, r *v1.UpdateArticleRequest) (*v1.Article, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	i := articleDO(r.GetArticle())
	if i != nil {
		i.EnterpriseID = e
	}
	o, x := s.uc.Update(c, i, r.GetChangeSummary())
	if x != nil {
		return nil, x
	}
	return articleDTO(o), nil
}
func (s *ArticleService) DeleteArticle(c context.Context, r *v1.DeleteArticleRequest) (*emptypb.Empty, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	if x = s.uc.Delete(c, e, r.GetId(), r.GetVersion()); x != nil {
		return nil, x
	}
	return &emptypb.Empty{}, nil
}
func (s *ArticleService) ChangeArticleStatus(c context.Context, r *v1.ChangeArticleStatusRequest) (*v1.Article, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	o, x := s.uc.ChangeStatus(c, e, r.GetId(), r.GetVersion(), r.GetAction(), r.GetReason())
	if x != nil {
		return nil, x
	}
	return articleDTO(o), nil
}
func (s *ArticleService) CreateArticleSnapshot(c context.Context, r *v1.CreateArticleSnapshotRequest) (*v1.ArticleSnapshot, error) {
	e, x := authn.RequireEnterprise(c)
	if x != nil {
		return nil, x
	}
	o, x := s.uc.CreateSnapshot(c, e, r.GetId(), r.GetVersion(), biz.SnapshotInput{ArticleTypeVersionID: r.GetArticleTypeVersionId(), PromptVersionID: r.GetPromptVersionId(), WritingModelID: r.GetWritingModelId(), InputSnapshotJSON: r.GetInputSnapshotJson(), KnowledgeRefsJSON: r.GetKnowledgeRefsJson(), GalleryRefsJSON: r.GetGalleryRefsJson()})
	if x != nil {
		return nil, x
	}
	return articleSnapshotDTO(o), nil
}
func articleDO(i *v1.Article) *biz.Article {
	if i == nil {
		return nil
	}
	return &biz.Article{ID: i.GetId(), BrandID: i.GetBrandId(), ArticleTypeID: i.GetArticleTypeId(), Title: i.GetTitle(), Summary: i.GetSummary(), ContentMarkdown: i.GetContentMarkdown(), ContentHTML: i.GetContentHtml(), Status: i.GetStatus(), Source: i.GetSource(), CurrentVersionID: i.GetCurrentVersionId(), LatestSnapshotID: i.GetLatestSnapshotId(), QualityScore: i.GetQualityScore(), QualityResultJSON: i.GetQualityResultJson(), Version: i.GetVersion()}
}
func articleDTO(i *biz.Article) *v1.Article {
	if i == nil {
		return nil
	}
	o := &v1.Article{Id: i.ID, BrandId: i.BrandID, ArticleTypeId: i.ArticleTypeID, Title: i.Title, Summary: i.Summary, ContentMarkdown: i.ContentMarkdown, ContentHtml: i.ContentHTML, Status: i.Status, Source: i.Source, CurrentVersionId: i.CurrentVersionID, LatestSnapshotId: i.LatestSnapshotID, QualityScore: i.QualityScore, QualityResultJson: i.QualityResultJSON, Version: i.Version, CreatedAt: timestamppb.New(i.CreatedAt), UpdatedAt: timestamppb.New(i.UpdatedAt), CoverImageUrl: i.CoverImageURL, ImageUrls: i.ImageURLs}
	if i.PublishedAt != nil {
		o.PublishedAt = timestamppb.New(*i.PublishedAt)
	}
	return o
}
func articleSnapshotDTO(i *biz.ArticleSnapshot) *v1.ArticleSnapshot {
	if i == nil {
		return nil
	}
	return &v1.ArticleSnapshot{Id: i.ID, ArticleId: i.ArticleID, ArticleVersionId: i.ArticleVersionID, ArticleTypeVersionId: i.ArticleTypeVersionID, PromptVersionId: i.PromptVersionID, WritingModelId: i.WritingModelID, Title: i.Title, ContentMarkdown: i.ContentMarkdown, ContentHtml: i.ContentHTML, InputSnapshotJson: i.InputSnapshotJSON, KnowledgeRefsJson: i.KnowledgeRefsJSON, GalleryRefsJson: i.GalleryRefsJSON, ContentHash: i.ContentHash, CreatedAt: timestamppb.New(i.CreatedAt)}
}
