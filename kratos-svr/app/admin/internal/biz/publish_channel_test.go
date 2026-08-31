package biz

import "testing"

func TestValidatePublishChannelAuthorization(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name              string
		category          int32
		authorizationType int32
		wantErr           bool
	}{
		{name: "self media requires client authorization", category: PublishChannelCategorySelfMedia, authorizationType: AuthorizationTypeClientLogin},
		{name: "self media rejects no authorization", category: PublishChannelCategorySelfMedia, authorizationType: AuthorizationTypeNone, wantErr: true},
		{name: "official media may not require authorization", category: PublishChannelCategoryOfficialMedia, authorizationType: AuthorizationTypeNone},
		{name: "unknown authorization type", category: PublishChannelCategoryKOL, authorizationType: 99, wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			item := &PublishChannel{
				Code: "channel", Name: "Channel", Category: tt.category,
				AuthorizationType: tt.authorizationType, ExecutionMode: ExecutionModeManual, Status: PublishChannelStatusActive,
			}
			if tt.category == PublishChannelCategorySelfMedia {
				item.DriverType = MediaDriverZhihu
				item.LoginURL = "https://www.zhihu.com/signin"
			}
			err := validatePublishChannel(item)
			if (err != nil) != tt.wantErr {
				t.Fatalf("validatePublishChannel() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidatePublishChannelNewMediaDrivers(t *testing.T) {
	t.Parallel()

	newDrivers := []struct {
		name    string
		driver  int32
		loginURL string
	}{
		{name: "netease", driver: MediaDriverNetease, loginURL: "https://mp.163.com/login.html"},
		{name: "sohu", driver: MediaDriverSohu, loginURL: "https://mp.sohu.com/mpfe/v4/login"},
		{name: "qqnews", driver: MediaDriverQqnews, loginURL: "https://om.qq.com/userAuth/index"},
		{name: "jianshu", driver: MediaDriverJianshu, loginURL: "https://www.jianshu.com/sign_in"},
		{name: "csdn", driver: MediaDriverCsdn, loginURL: "https://passport.csdn.net/login"},
	}

	for _, tt := range newDrivers {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			item := &PublishChannel{
				Code:              tt.name,
				Name:              tt.name,
				Category:          PublishChannelCategorySelfMedia,
				AuthorizationType: AuthorizationTypeClientLogin,
				ExecutionMode:     ExecutionModeManual,
				Status:            PublishChannelStatusActive,
				DriverType:        tt.driver,
				LoginURL:          tt.loginURL,
			}
			if err := validatePublishChannel(item); err != nil {
				t.Fatalf("validatePublishChannel() error = %v for driver %d", err, tt.driver)
			}
		})
	}
}
