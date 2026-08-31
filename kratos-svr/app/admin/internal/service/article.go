package service

import (
	"context"

	v1 "kratos-svr/api/admin/v1"
	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/query"

	"google.golang.org/protobuf/types/known/timestamppb"
)

type ArticleService struct {
	v1.UnimplementedArticleServiceServer
	uc *biz.AdminArticleUsecase
}

func NewArticleService(uc *biz.AdminArticleUsecase) *ArticleService { return &ArticleService{uc: uc} }
func (s *ArticleService) ListArticles(ctx context.Context, req *v1.ListArticlesRequest) (*v1.ListArticlesReply, error) {
	page, err := query.ParsePage(req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, biz.ErrArticleInvalid
	}
	opts := biz.AdminArticleListOptions{Offset: page.Offset, Limit: page.Limit, EnterpriseID: req.GetEnterpriseId(), BrandID: req.GetBrandId(), Status: req.GetStatus(), Source: req.GetSource(), Keyword: req.GetKeyword()}
	if req.MinQualityScore != nil {
		v := req.GetMinQualityScore()
		opts.MinQualityScore = &v
	}
	items, total, err := s.uc.List(ctx, opts)
	if err != nil {
		return nil, err
	}
	reply := &v1.ListArticlesReply{Items: make([]*v1.Article, 0, len(items)), TotalSize: total}
	for _, item := range items {
		reply.Items = append(reply.Items, articleDTO(item))
	}
	if page.Offset+len(items) < int(total) {
		reply.NextPageToken = query.NextToken(page.Offset + len(items))
	}
	return reply, nil
}
func (s *ArticleService) GetArticle(ctx context.Context, req *v1.GetArticleRequest) (*v1.ArticleDetail, error) {
	d, err := s.uc.Get(ctx, req.GetId())
	if err != nil {
		return nil, err
	}
	return articleDetailDTO(d), nil
}
func (s *ArticleService) ReviewArticle(ctx context.Context, req *v1.ReviewArticleRequest) (*v1.ArticleDetail, error) {
	op, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	d, err := s.uc.Review(ctx, biz.AdminArticleAction{ID: req.GetId(), Version: req.GetVersion(), OperatorID: op, Action: req.GetAction(), Reason: req.GetReason()})
	if err != nil {
		return nil, err
	}
	return articleDetailDTO(d), nil
}
func (s *ArticleService) ArchiveArticle(ctx context.Context, req *v1.ArchiveArticleRequest) (*v1.ArticleDetail, error) {
	op, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	d, err := s.uc.Archive(ctx, biz.AdminArticleAction{ID: req.GetId(), Version: req.GetVersion(), OperatorID: op, Reason: req.GetReason()})
	if err != nil {
		return nil, err
	}
	return articleDetailDTO(d), nil
}
func articleDTO(v *biz.AdminArticle) *v1.Article {
	if v == nil {
		return nil
	}
	return &v1.Article{Id: v.ID, EnterpriseId: v.EnterpriseID, EnterpriseName: v.EnterpriseName, BrandId: v.BrandID, BrandName: v.BrandName, ArticleTypeId: v.ArticleTypeID, ArticleTypeName: v.ArticleTypeName, Title: v.Title, Summary: v.Summary, ContentMarkdown: v.ContentMarkdown, ContentHtml: v.ContentHTML, Status: v.Status, Source: v.Source, CurrentVersionId: v.CurrentVersionID, LatestSnapshotId: v.LatestSnapshotID, QualityScore: v.QualityScore, QualityResultJson: v.QualityResultJSON, PublishedAt: timestampProto(v.PublishedAt), Version: v.Version, CreatedAt: timestamppb.New(v.CreatedAt), UpdatedAt: timestamppb.New(v.UpdatedAt)}
}
func articleDetailDTO(d *biz.AdminArticleDetail) *v1.ArticleDetail {
	out := &v1.ArticleDetail{Article: articleDTO(d.Article)}
	for _, v := range d.Versions {
		out.Versions = append(out.Versions, &v1.ArticleVersion{Id: v.ID, VersionNumber: v.VersionNumber, Title: v.Title, Summary: v.Summary, ChangeSource: v.ChangeSource, ChangeSummary: v.ChangeSummary, OperatorType: v.OperatorType, OperatorId: v.OperatorID, CreatedAt: timestamppb.New(v.CreatedAt)})
	}
	for _, v := range d.Reviews {
		out.Reviews = append(out.Reviews, &v1.ArticleReview{Id: v.ID, Action: v.Action, FromStatus: v.FromStatus, ToStatus: v.ToStatus, ReviewerType: v.ReviewerType, ReviewerId: v.ReviewerID, Reason: v.Reason, CreatedAt: timestamppb.New(v.CreatedAt)})
	}
	return out
}
