package model

const (
	AuthorizationResourcePublishChannel int32 = 1
	AuthorizationResourceInclusionSite  int32 = 2

	AuthorizationStatusPending     int32 = 1
	AuthorizationStatusAuthorizing int32 = 2
	AuthorizationStatusActive      int32 = 3
	AuthorizationStatusExpired     int32 = 4
	AuthorizationStatusRevoked     int32 = 5
	AuthorizationStatusFailed      int32 = 6

	AuthorizationUsageEnabled  int32 = 1
	AuthorizationUsagePaused   int32 = 2
	AuthorizationUsageDisabled int32 = 3
)
