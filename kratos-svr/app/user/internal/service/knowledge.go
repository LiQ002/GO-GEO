package service

import (
	"context"

	v1 "kratos-svr/api/user/v1"
	"kratos-svr/app/user/internal/biz"
	"kratos-svr/internal/authn"
	"kratos-svr/internal/query"

	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type KnowledgeService struct {
	v1.UnimplementedKnowledgeServiceServer
	usecase *biz.KnowledgeUsecase
}

func NewKnowledgeService(usecase *biz.KnowledgeUsecase) *KnowledgeService {
	return &KnowledgeService{usecase: usecase}
}

func (s *KnowledgeService) CreateKnowledgeBase(ctx context.Context, req *v1.CreateKnowledgeBaseRequest) (*v1.KnowledgeBase, error) {
	enterpriseID, err := authn.RequireEnterprise(ctx)
	if err != nil {
		return nil, err
	}
	base := knowledgeBaseDO(req.GetKnowledgeBase())
	if base != nil {
		base.EnterpriseID = enterpriseID
	}
	created, err := s.usecase.CreateBase(ctx, base)
	if err != nil {
		return nil, err
	}
	return knowledgeBaseDTO(created), nil
}

func (s *KnowledgeService) GetKnowledgeBase(ctx context.Context, req *v1.GetKnowledgeBaseRequest) (*v1.KnowledgeBase, error) {
	enterpriseID, err := authn.RequireEnterprise(ctx)
	if err != nil {
		return nil, err
	}
	base, err := s.usecase.GetBase(ctx, enterpriseID, req.GetId())
	if err != nil {
		return nil, err
	}
	return knowledgeBaseDTO(base), nil
}

func (s *KnowledgeService) ListKnowledgeBases(ctx context.Context, req *v1.ListKnowledgeBasesRequest) (*v1.ListKnowledgeBasesReply, error) {
	enterpriseID, err := authn.RequireEnterprise(ctx)
	if err != nil {
		return nil, err
	}
	page, err := parseUserPage(req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, biz.ErrKnowledgeBaseInvalid
	}
	items, total, err := s.usecase.ListBases(ctx, enterpriseID, biz.KnowledgeBaseListOptions{
		Offset:  page.Offset,
		Limit:   page.Limit,
		Status:  req.GetStatus(),
		Keyword: req.GetKeyword(),
	})
	if err != nil {
		return nil, err
	}
	reply := &v1.ListKnowledgeBasesReply{Items: make([]*v1.KnowledgeBase, 0, len(items)), TotalSize: total}
	for _, item := range items {
		reply.Items = append(reply.Items, knowledgeBaseDTO(item))
	}
	if page.Offset+len(items) < int(total) {
		reply.NextPageToken = query.NextToken(page.Offset + len(items))
	}
	return reply, nil
}

func (s *KnowledgeService) UpdateKnowledgeBase(ctx context.Context, req *v1.UpdateKnowledgeBaseRequest) (*v1.KnowledgeBase, error) {
	enterpriseID, err := authn.RequireEnterprise(ctx)
	if err != nil {
		return nil, err
	}
	base := knowledgeBaseDO(req.GetKnowledgeBase())
	if base != nil {
		base.EnterpriseID = enterpriseID
	}
	updated, err := s.usecase.UpdateBase(ctx, base)
	if err != nil {
		return nil, err
	}
	return knowledgeBaseDTO(updated), nil
}

func (s *KnowledgeService) DeleteKnowledgeBase(ctx context.Context, req *v1.DeleteKnowledgeBaseRequest) (*emptypb.Empty, error) {
	enterpriseID, err := authn.RequireEnterprise(ctx)
	if err != nil {
		return nil, err
	}
	if err := s.usecase.DeleteBase(ctx, enterpriseID, req.GetId(), req.GetVersion()); err != nil {
		return nil, err
	}
	return &emptypb.Empty{}, nil
}

func (s *KnowledgeService) CreateKnowledgeDocument(ctx context.Context, req *v1.CreateKnowledgeDocumentRequest) (*v1.KnowledgeDocument, error) {
	enterpriseID, err := authn.RequireEnterprise(ctx)
	if err != nil {
		return nil, err
	}
	document := knowledgeDocumentDO(req.GetDocument())
	if document != nil {
		document.EnterpriseID = enterpriseID
		document.Content = req.GetContent()
	}
	created, err := s.usecase.CreateDocument(ctx, document)
	if err != nil {
		return nil, err
	}
	return knowledgeDocumentDTO(created), nil
}

func (s *KnowledgeService) GetKnowledgeDocument(ctx context.Context, req *v1.GetKnowledgeDocumentRequest) (*v1.KnowledgeDocument, error) {
	enterpriseID, err := authn.RequireEnterprise(ctx)
	if err != nil {
		return nil, err
	}
	document, err := s.usecase.GetDocument(ctx, enterpriseID, req.GetId())
	if err != nil {
		return nil, err
	}
	return knowledgeDocumentDTO(document), nil
}

func (s *KnowledgeService) ListKnowledgeDocuments(ctx context.Context, req *v1.ListKnowledgeDocumentsRequest) (*v1.ListKnowledgeDocumentsReply, error) {
	enterpriseID, err := authn.RequireEnterprise(ctx)
	if err != nil {
		return nil, err
	}
	page, err := parseUserPage(req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, biz.ErrKnowledgeDocInvalid
	}
	items, total, err := s.usecase.ListDocuments(ctx, enterpriseID, biz.KnowledgeDocumentListOptions{
		Offset:          page.Offset,
		Limit:           page.Limit,
		KnowledgeBaseID: req.GetKnowledgeBaseId(),
		Category:        req.GetCategory(),
		SourceType:      req.GetSourceType(),
		ParseStatus:     req.GetParseStatus(),
		Keyword:         req.GetKeyword(),
	})
	if err != nil {
		return nil, err
	}
	reply := &v1.ListKnowledgeDocumentsReply{Items: make([]*v1.KnowledgeDocument, 0, len(items)), TotalSize: total}
	for _, item := range items {
		reply.Items = append(reply.Items, knowledgeDocumentDTO(item))
	}
	if page.Offset+len(items) < int(total) {
		reply.NextPageToken = query.NextToken(page.Offset + len(items))
	}
	return reply, nil
}

func (s *KnowledgeService) UpdateKnowledgeDocument(ctx context.Context, req *v1.UpdateKnowledgeDocumentRequest) (*v1.KnowledgeDocument, error) {
	enterpriseID, err := authn.RequireEnterprise(ctx)
	if err != nil {
		return nil, err
	}
	document := knowledgeDocumentDO(req.GetDocument())
	if document != nil {
		document.EnterpriseID = enterpriseID
		document.Content = req.GetContent()
	}
	updated, err := s.usecase.UpdateDocument(ctx, document)
	if err != nil {
		return nil, err
	}
	return knowledgeDocumentDTO(updated), nil
}

func (s *KnowledgeService) DeleteKnowledgeDocument(ctx context.Context, req *v1.DeleteKnowledgeDocumentRequest) (*emptypb.Empty, error) {
	enterpriseID, err := authn.RequireEnterprise(ctx)
	if err != nil {
		return nil, err
	}
	if err := s.usecase.DeleteDocument(ctx, enterpriseID, req.GetId(), req.GetDocumentVersion()); err != nil {
		return nil, err
	}
	return &emptypb.Empty{}, nil
}

func (s *KnowledgeService) RetryKnowledgeDocumentParse(ctx context.Context, req *v1.RetryKnowledgeDocumentParseRequest) (*v1.KnowledgeDocument, error) {
	enterpriseID, err := authn.RequireEnterprise(ctx)
	if err != nil {
		return nil, err
	}
	document, err := s.usecase.RetryDocumentParse(ctx, enterpriseID, req.GetId(), req.GetDocumentVersion())
	if err != nil {
		return nil, err
	}
	return knowledgeDocumentDTO(document), nil
}

func (s *KnowledgeService) ListKnowledgeChunks(ctx context.Context, req *v1.ListKnowledgeChunksRequest) (*v1.ListKnowledgeChunksReply, error) {
	enterpriseID, err := authn.RequireEnterprise(ctx)
	if err != nil {
		return nil, err
	}
	page, err := parseUserPage(req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, biz.ErrKnowledgeDocInvalid
	}
	items, total, err := s.usecase.ListChunks(ctx, enterpriseID, req.GetKnowledgeDocumentId(), biz.KnowledgeChunkListOptions{
		Offset:          page.Offset,
		Limit:           page.Limit,
		DocumentVersion: req.GetDocumentVersion(),
	})
	if err != nil {
		return nil, err
	}
	reply := &v1.ListKnowledgeChunksReply{Items: make([]*v1.KnowledgeChunk, 0, len(items)), TotalSize: total}
	for _, item := range items {
		reply.Items = append(reply.Items, knowledgeChunkDTO(item))
	}
	if page.Offset+len(items) < int(total) {
		reply.NextPageToken = query.NextToken(page.Offset + len(items))
	}
	return reply, nil
}

func knowledgeBaseDO(base *v1.KnowledgeBase) *biz.KnowledgeBase {
	if base == nil {
		return nil
	}
	return &biz.KnowledgeBase{
		ID:          base.GetId(),
		Name:        base.GetName(),
		Description: base.GetDescription(),
		Status:      base.GetStatus(),
		Version:     base.GetVersion(),
	}
}

func knowledgeBaseDTO(base *biz.KnowledgeBase) *v1.KnowledgeBase {
	if base == nil {
		return nil
	}
	return &v1.KnowledgeBase{
		Id:          base.ID,
		Name:        base.Name,
		Description: base.Description,
		Status:      base.Status,
		Version:     base.Version,
		CreatedAt:   timestamppb.New(base.CreatedAt),
		UpdatedAt:   timestamppb.New(base.UpdatedAt),
	}
}

func knowledgeDocumentDO(document *v1.KnowledgeDocument) *biz.KnowledgeDocument {
	if document == nil {
		return nil
	}
	return &biz.KnowledgeDocument{
		ID:              document.GetId(),
		KnowledgeBaseID: document.GetKnowledgeBaseId(),
		Category:        document.GetCategory(),
		Title:           document.GetTitle(),
		Content:         document.GetContent(),
		SourceType:      document.GetSourceType(),
		SourceURL:       document.GetSourceUrl(),
		ObjectKey:       document.GetObjectKey(),
		MimeType:        document.GetMimeType(),
		DocumentVersion: document.GetDocumentVersion(),
		MetadataJSON:    document.GetMetadataJson(),
	}
}

func knowledgeDocumentDTO(document *biz.KnowledgeDocument) *v1.KnowledgeDocument {
	if document == nil {
		return nil
	}
	return &v1.KnowledgeDocument{
		Id:              document.ID,
		KnowledgeBaseId: document.KnowledgeBaseID,
		Category:        document.Category,
		Title:           document.Title,
		Content:         document.Content,
		SourceType:      document.SourceType,
		SourceUrl:       document.SourceURL,
		ObjectKey:       document.ObjectKey,
		ContentHash:     document.ContentHash,
		MimeType:        document.MimeType,
		ParseStatus:     document.ParseStatus,
		ParseError:      document.ParseError,
		DocumentVersion: document.DocumentVersion,
		MetadataJson:    document.MetadataJSON,
		CreatedAt:       timestamppb.New(document.CreatedAt),
		UpdatedAt:       timestamppb.New(document.UpdatedAt),
	}
}

func knowledgeChunkDTO(chunk *biz.KnowledgeChunk) *v1.KnowledgeChunk {
	if chunk == nil {
		return nil
	}
	return &v1.KnowledgeChunk{
		Id:                  chunk.ID,
		KnowledgeDocumentId: chunk.KnowledgeDocumentID,
		DocumentVersion:     chunk.DocumentVersion,
		ChunkIndex:          chunk.ChunkIndex,
		Content:             chunk.Content,
		ContentHash:         chunk.ContentHash,
		LocatorJson:         chunk.LocatorJSON,
		MetadataJson:        chunk.MetadataJSON,
		CreatedAt:           timestamppb.New(chunk.CreatedAt),
	}
}
