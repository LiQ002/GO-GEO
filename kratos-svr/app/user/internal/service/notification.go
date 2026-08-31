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

type NotificationService struct {
	v1.UnimplementedNotificationServiceServer
	usecase *biz.NotificationUsecase
}

func NewNotificationService(usecase *biz.NotificationUsecase) *NotificationService {
	return &NotificationService{usecase: usecase}
}

func (s *NotificationService) GetNotification(ctx context.Context, req *v1.GetNotificationRequest) (*v1.Notification, error) {
	enterpriseID, accountID, err := notificationPrincipal(ctx)
	if err != nil {
		return nil, err
	}
	item, err := s.usecase.Get(ctx, enterpriseID, accountID, req.GetId())
	if err != nil {
		return nil, err
	}
	return notificationDTO(item), nil
}

func (s *NotificationService) ListNotifications(ctx context.Context, req *v1.ListNotificationsRequest) (*v1.ListNotificationsReply, error) {
	enterpriseID, accountID, err := notificationPrincipal(ctx)
	if err != nil {
		return nil, err
	}
	page, err := parseUserPage(req.GetPageSize(), req.GetPageToken())
	if err != nil {
		return nil, biz.ErrNotificationInvalid
	}
	items, total, err := s.usecase.List(ctx, enterpriseID, accountID, biz.NotificationListOptions{
		Offset: page.Offset, Limit: page.Limit, UnreadOnly: req.GetUnreadOnly(), Channel: req.GetChannel(),
	})
	if err != nil {
		return nil, err
	}
	reply := &v1.ListNotificationsReply{Items: make([]*v1.Notification, 0, len(items)), TotalSize: total}
	for _, item := range items {
		reply.Items = append(reply.Items, notificationDTO(item))
	}
	if page.Offset+len(items) < int(total) {
		reply.NextPageToken = query.NextToken(page.Offset + len(items))
	}
	return reply, nil
}

func (s *NotificationService) GetUnreadNotificationCount(ctx context.Context, _ *emptypb.Empty) (*v1.UnreadNotificationCountReply, error) {
	enterpriseID, accountID, err := notificationPrincipal(ctx)
	if err != nil {
		return nil, err
	}
	count, err := s.usecase.UnreadCount(ctx, enterpriseID, accountID)
	if err != nil {
		return nil, err
	}
	return &v1.UnreadNotificationCountReply{UnreadCount: count}, nil
}

func (s *NotificationService) MarkNotificationRead(ctx context.Context, req *v1.MarkNotificationReadRequest) (*v1.Notification, error) {
	enterpriseID, accountID, err := notificationPrincipal(ctx)
	if err != nil {
		return nil, err
	}
	item, err := s.usecase.MarkRead(ctx, enterpriseID, accountID, req.GetId())
	if err != nil {
		return nil, err
	}
	return notificationDTO(item), nil
}

func (s *NotificationService) MarkAllNotificationsRead(ctx context.Context, _ *emptypb.Empty) (*v1.MarkAllNotificationsReadReply, error) {
	enterpriseID, accountID, err := notificationPrincipal(ctx)
	if err != nil {
		return nil, err
	}
	count, err := s.usecase.MarkAllRead(ctx, enterpriseID, accountID)
	if err != nil {
		return nil, err
	}
	return &v1.MarkAllNotificationsReadReply{UpdatedCount: count}, nil
}

func notificationPrincipal(ctx context.Context) (uint64, uint64, error) {
	enterpriseID, err := authn.RequireEnterprise(ctx)
	if err != nil {
		return 0, 0, err
	}
	principal, ok := authn.PrincipalFromContext(ctx)
	if !ok || principal.SubjectID == 0 {
		return 0, 0, biz.ErrNotificationInvalid
	}
	return enterpriseID, principal.SubjectID, nil
}

func notificationDTO(item *biz.Notification) *v1.Notification {
	if item == nil {
		return nil
	}
	dto := &v1.Notification{
		Id: item.ID, Channel: item.Channel, TemplateCode: item.TemplateCode,
		PayloadJson: item.PayloadJSON, DeliveryStatus: item.DeliveryStatus,
		ScheduledAt: timestamppb.New(item.ScheduledAt), CreatedAt: timestamppb.New(item.CreatedAt),
	}
	if item.SentAt != nil {
		dto.SentAt = timestamppb.New(*item.SentAt)
	}
	if item.ReadAt != nil {
		dto.ReadAt = timestamppb.New(*item.ReadAt)
	}
	return dto
}
