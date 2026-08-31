package service

import (
	"testing"

	"kratos-svr/app/admin/internal/biz"
)

func TestCustomerAuthorizationDTOResourceFields(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name                     string
		resourceType             string
		wantLegacyPublishChannel bool
	}{
		{name: "publish channel keeps legacy fields", resourceType: "publish_channel", wantLegacyPublishChannel: true},
		{name: "inclusion site uses generic fields", resourceType: "inclusion_site"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			item := &biz.CustomerAuthorization{
				ResourceType: tt.resourceType,
				ResourceID:   42,
				ResourceCode: "demo",
				ResourceName: "Demo",
			}
			got := customerAuthorizationDTO(item)
			if got.GetResourceType() != tt.resourceType || got.GetResourceId() != 42 || got.GetResourceCode() != "demo" || got.GetResourceName() != "Demo" {
				t.Fatalf("customerAuthorizationDTO() generic resource = (%q, %d, %q, %q)", got.GetResourceType(), got.GetResourceId(), got.GetResourceCode(), got.GetResourceName())
			}
			if tt.wantLegacyPublishChannel != (got.GetPublishChannelId() == 42 && got.GetChannelCode() == "demo" && got.GetChannelName() == "Demo") {
				t.Fatalf("customerAuthorizationDTO() legacy publish-channel fields = (%d, %q, %q)", got.GetPublishChannelId(), got.GetChannelCode(), got.GetChannelName())
			}
		})
	}
}
