package service

import (
	"context"

	v1 "kratos-svr/api/admin/v1"
	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/internal/query"

	"google.golang.org/protobuf/types/known/timestamppb"
)

type RealnameAuthenticationService struct {
	v1.UnimplementedRealnameAuthenticationServiceServer
	uc *biz.RealnameUsecase
}

func NewRealnameAuthenticationService(uc *biz.RealnameUsecase) *RealnameAuthenticationService {
	return &RealnameAuthenticationService{uc: uc}
}

func (s *RealnameAuthenticationService) ListRealnameAuthentications(ctx context.Context, req *v1.ListRealnameAuthenticationsRequest) (*v1.ListRealnameAuthenticationsReply, error) {
	page, err := query.ParsePage(req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, biz.ErrRealnameInvalid
	}
	items, total, err := s.uc.List(ctx, biz.RealnameListOptions{
		Offset: page.Offset, Limit: page.Limit,
		Keyword: req.GetKeyword(), Status: req.GetStatus(), Type: req.GetType(),
	})
	if err != nil {
		return nil, err
	}
	reply := &v1.ListRealnameAuthenticationsReply{
		Items:     make([]*v1.RealnameAuthenticationDetail, 0, len(items)),
		TotalSize: total,
	}
	for _, item := range items {
		reply.Items = append(reply.Items, realnameDetailDTO(item))
	}
	if page.Offset+len(items) < int(total) {
		reply.NextPageToken = query.NextToken(page.Offset + len(items))
	}
	return reply, nil
}

func (s *RealnameAuthenticationService) ApproveRealnameAuthentication(ctx context.Context, req *v1.ApproveRealnameAuthenticationRequest) (*v1.RealnameAuthenticationDetail, error) {
	operatorID, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	item, err := s.uc.Approve(ctx, req.GetId(), operatorID)
	if err != nil {
		return nil, err
	}
	return realnameDetailDTO(item), nil
}

func (s *RealnameAuthenticationService) RejectRealnameAuthentication(ctx context.Context, req *v1.RejectRealnameAuthenticationRequest) (*v1.RealnameAuthenticationDetail, error) {
	operatorID, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	item, err := s.uc.Reject(ctx, req.GetId(), req.GetRejectReason(), operatorID)
	if err != nil {
		return nil, err
	}
	return realnameDetailDTO(item), nil
}

func (s *RealnameAuthenticationService) DeleteRealnameAuthentication(ctx context.Context, req *v1.DeleteRealnameAuthenticationRequest) (*v1.DeleteRealnameAuthenticationReply, error) {
	operatorID, err := adminOperatorID(ctx)
	if err != nil {
		return nil, err
	}
	if err := s.uc.Delete(ctx, req.GetId(), operatorID); err != nil {
		return nil, err
	}
	return &v1.DeleteRealnameAuthenticationReply{Success: true}, nil
}

func realnameDetailDTO(item *biz.RealnameAuthenticationDetail) *v1.RealnameAuthenticationDetail {
	if item == nil {
		return nil
	}
	reply := &v1.RealnameAuthenticationDetail{
		Authentication: realnameDTO(item.Authentication),
		EnterpriseName: item.EnterpriseName,
		EnterpriseCode: item.EnterpriseCode,
		Username:       item.Username,
	}
	return reply
}

func realnameDTO(item *biz.RealnameAuthentication) *v1.RealnameAuthentication {
	if item == nil {
		return nil
	}
	var reviewedBy uint64
	if item.ReviewedBy != nil {
		reviewedBy = *item.ReviewedBy
	}
	return &v1.RealnameAuthentication{
		Id:              item.ID,
		EnterpriseId:    item.EnterpriseID,
		Type:            item.Type,
		Status:          item.Status,
		RealName:        item.RealName,
		IdCardNumber:    item.IDCardNumber,
		Mobile:          item.Mobile,
		CompanyName:     item.CompanyName,
		RegistrationNo: item.RegistrationNo,
		LicenseImageUrl: item.LicenseImageURL,
		IdCardImageUrl:  item.IDCardImageURL,
		RejectReason:    item.RejectReason,
		ReviewedBy:      reviewedBy,
		ReviewedAt:      timestampProto(item.ReviewedAt),
		SubmittedAt:     timestamppb.New(item.SubmittedAt),
	}
}
