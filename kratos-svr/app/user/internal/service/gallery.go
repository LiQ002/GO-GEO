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

type GalleryService struct {
	v1.UnimplementedGalleryServiceServer
	usecase *biz.GalleryUsecase
}

func NewGalleryService(usecase *biz.GalleryUsecase) *GalleryService {
	return &GalleryService{usecase: usecase}
}

func (s *GalleryService) CreateGalleryAlbum(ctx context.Context, req *v1.CreateGalleryAlbumRequest) (*v1.GalleryAlbum, error) {
	enterpriseID, err := authn.RequireEnterprise(ctx)
	if err != nil {
		return nil, err
	}
	album := galleryAlbumDO(req.GetAlbum())
	if album != nil {
		album.EnterpriseID = enterpriseID
	}
	created, err := s.usecase.CreateAlbum(ctx, album)
	if err != nil {
		return nil, err
	}
	return galleryAlbumDTO(created), nil
}

func (s *GalleryService) GetGalleryAlbum(ctx context.Context, req *v1.GetGalleryAlbumRequest) (*v1.GalleryAlbum, error) {
	enterpriseID, err := authn.RequireEnterprise(ctx)
	if err != nil {
		return nil, err
	}
	album, err := s.usecase.GetAlbum(ctx, enterpriseID, req.GetId())
	if err != nil {
		return nil, err
	}
	return galleryAlbumDTO(album), nil
}

func (s *GalleryService) ListGalleryAlbums(ctx context.Context, req *v1.ListGalleryAlbumsRequest) (*v1.ListGalleryAlbumsReply, error) {
	enterpriseID, err := authn.RequireEnterprise(ctx)
	if err != nil {
		return nil, err
	}
	page, err := parseUserPage(req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, biz.ErrGalleryAlbumInvalid
	}
	items, total, err := s.usecase.ListAlbums(ctx, enterpriseID, biz.GalleryAlbumListOptions{
		Offset:   page.Offset,
		Limit:    page.Limit,
		Category: req.GetCategory(),
		Keyword:  req.GetKeyword(),
	})
	if err != nil {
		return nil, err
	}
	reply := &v1.ListGalleryAlbumsReply{
		Items:     make([]*v1.GalleryAlbum, 0, len(items)),
		TotalSize: total,
	}
	for _, item := range items {
		reply.Items = append(reply.Items, galleryAlbumDTO(item))
	}
	if page.Offset+len(items) < int(total) {
		reply.NextPageToken = query.NextToken(page.Offset + len(items))
	}
	return reply, nil
}

func (s *GalleryService) UpdateGalleryAlbum(ctx context.Context, req *v1.UpdateGalleryAlbumRequest) (*v1.GalleryAlbum, error) {
	enterpriseID, err := authn.RequireEnterprise(ctx)
	if err != nil {
		return nil, err
	}
	album := galleryAlbumDO(req.GetAlbum())
	if album != nil {
		album.EnterpriseID = enterpriseID
	}
	updated, err := s.usecase.UpdateAlbum(ctx, album)
	if err != nil {
		return nil, err
	}
	return galleryAlbumDTO(updated), nil
}

func (s *GalleryService) DeleteGalleryAlbum(ctx context.Context, req *v1.DeleteGalleryAlbumRequest) (*emptypb.Empty, error) {
	enterpriseID, err := authn.RequireEnterprise(ctx)
	if err != nil {
		return nil, err
	}
	if err := s.usecase.DeleteAlbum(ctx, enterpriseID, req.GetId(), req.GetVersion()); err != nil {
		return nil, err
	}
	return &emptypb.Empty{}, nil
}

func (s *GalleryService) UploadGalleryImage(ctx context.Context, req *v1.UploadGalleryImageRequest) (*v1.GalleryImage, error) {
	enterpriseID, err := authn.RequireEnterprise(ctx)
	if err != nil {
		return nil, err
	}
	created, err := s.usecase.UploadImage(ctx, &biz.GalleryImage{
		EnterpriseID: enterpriseID,
		AlbumID:      req.GetAlbumId(),
		OriginalName: req.GetOriginalName(),
		MimeType:     req.GetMimeType(),
		Content:      req.GetContent(),
	})
	if err != nil {
		return nil, err
	}
	return galleryImageDTO(created), nil
}

func (s *GalleryService) ListGalleryImages(ctx context.Context, req *v1.ListGalleryImagesRequest) (*v1.ListGalleryImagesReply, error) {
	enterpriseID, err := authn.RequireEnterprise(ctx)
	if err != nil {
		return nil, err
	}
	page, err := parseUserPage(req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, biz.ErrGalleryImageInvalid
	}
	items, total, err := s.usecase.ListImages(ctx, enterpriseID, biz.GalleryImageListOptions{
		Offset:  page.Offset,
		Limit:   page.Limit,
		AlbumID: req.GetAlbumId(),
		Keyword: req.GetKeyword(),
	})
	if err != nil {
		return nil, err
	}
	reply := &v1.ListGalleryImagesReply{
		Items:     make([]*v1.GalleryImage, 0, len(items)),
		TotalSize: total,
	}
	for _, item := range items {
		reply.Items = append(reply.Items, galleryImageDTO(item))
	}
	if page.Offset+len(items) < int(total) {
		reply.NextPageToken = query.NextToken(page.Offset + len(items))
	}
	return reply, nil
}

func (s *GalleryService) DeleteGalleryImage(ctx context.Context, req *v1.DeleteGalleryImageRequest) (*emptypb.Empty, error) {
	enterpriseID, err := authn.RequireEnterprise(ctx)
	if err != nil {
		return nil, err
	}
	if err := s.usecase.DeleteImage(ctx, enterpriseID, req.GetId(), req.GetVersion()); err != nil {
		return nil, err
	}
	return &emptypb.Empty{}, nil
}

func galleryAlbumDO(album *v1.GalleryAlbum) *biz.GalleryAlbum {
	if album == nil {
		return nil
	}
	return &biz.GalleryAlbum{
		ID:          album.GetId(),
		Name:        album.GetName(),
		Category:    album.GetCategory(),
		Description: album.GetDescription(),
		Version:     album.GetVersion(),
	}
}

func galleryAlbumDTO(album *biz.GalleryAlbum) *v1.GalleryAlbum {
	if album == nil {
		return nil
	}
	return &v1.GalleryAlbum{
		Id:            album.ID,
		Name:          album.Name,
		Category:      album.Category,
		Description:   album.Description,
		Version:       album.Version,
		ImageCount:    album.ImageCount,
		CoverImageUrl: album.CoverImageURL,
		CreatedAt:     timestamppb.New(album.CreatedAt),
		UpdatedAt:     timestamppb.New(album.UpdatedAt),
	}
}

func galleryImageDTO(image *biz.GalleryImage) *v1.GalleryImage {
	if image == nil {
		return nil
	}
	return &v1.GalleryImage{
		Id:           image.ID,
		AlbumId:      image.AlbumID,
		OriginalName: image.OriginalName,
		ObjectKey:    image.ObjectKey,
		Url:          image.URL,
		MimeType:     image.MimeType,
		SizeBytes:    image.SizeBytes,
		ContentHash:  image.ContentHash,
		Version:      image.Version,
		CreatedAt:    timestamppb.New(image.CreatedAt),
	}
}
