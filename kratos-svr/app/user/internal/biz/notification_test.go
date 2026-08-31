package biz

import (
	"context"
	"errors"
	"testing"
)

type notificationRepoStub struct {
	getEnterpriseID uint64
	getAccountID    uint64
	markAllCount    int64
}

func (r *notificationRepoStub) Get(_ context.Context, enterpriseID, accountID, id uint64) (*Notification, error) {
	r.getEnterpriseID, r.getAccountID = enterpriseID, accountID
	return &Notification{ID: id, EnterpriseID: enterpriseID, RecipientID: accountID}, nil
}
func (*notificationRepoStub) List(context.Context, uint64, uint64, NotificationListOptions) ([]*Notification, int64, error) {
	return nil, 0, nil
}
func (*notificationRepoStub) UnreadCount(context.Context, uint64, uint64) (int64, error) {
	return 0, nil
}
func (r *notificationRepoStub) MarkRead(ctx context.Context, enterpriseID, accountID, id uint64) (*Notification, error) {
	return r.Get(ctx, enterpriseID, accountID, id)
}
func (r *notificationRepoStub) MarkAllRead(context.Context, uint64, uint64) (int64, error) {
	return r.markAllCount, nil
}

func TestNotificationUsecaseRejectsMissingTenantIdentity(t *testing.T) {
	u := NewNotificationUsecase(&notificationRepoStub{})
	if _, err := u.Get(context.Background(), 0, 2, 3); !errors.Is(err, ErrNotificationInvalid) {
		t.Fatalf("Get() error = %v, want %v", err, ErrNotificationInvalid)
	}
	if _, _, err := u.List(context.Background(), 1, 2, NotificationListOptions{}); !errors.Is(err, ErrNotificationInvalid) {
		t.Fatalf("List() error = %v, want %v", err, ErrNotificationInvalid)
	}
}

func TestNotificationUsecasePassesTenantAndAccountScope(t *testing.T) {
	repo := &notificationRepoStub{}
	u := NewNotificationUsecase(repo)
	item, err := u.MarkRead(context.Background(), 11, 22, 33)
	if err != nil {
		t.Fatal(err)
	}
	if repo.getEnterpriseID != 11 || repo.getAccountID != 22 || item.ID != 33 {
		t.Fatalf("scope = (%d, %d), item = %d", repo.getEnterpriseID, repo.getAccountID, item.ID)
	}
}
