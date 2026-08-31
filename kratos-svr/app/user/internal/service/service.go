package service

import "github.com/google/wire"

// ProviderSet is service providers.
var ProviderSet = wire.NewSet(NewAuthService, NewBrandService, NewKnowledgeService, NewGalleryService, NewKeywordService, NewQuestionService, NewCatalogService, NewArticleService, NewArticleGenerationService, NewPlatformAccountService, NewClientAuthorizationService, NewPublishTaskService, NewGeoMonitorService, NewGeoReportService, NewGeoBrandBoardService, NewNotificationService, NewExportJobService, NewSubscriptionOrderService, NewRealnameService)
