package biz

import "github.com/google/wire"

// ProviderSet is biz providers.
var ProviderSet = wire.NewSet(NewAuthUsecase, NewBrandUsecase, NewKnowledgeUsecase, NewGalleryUsecase, NewKeywordUsecase, NewKeywordDistillationUsecase, NewQuestionUsecase, NewCatalogUsecase, NewArticleUsecase, NewArticleGenerationUsecase, NewPlatformAccountUsecase, NewPublishTaskUsecase, NewGeoMonitorUsecase, NewNotificationUsecase, NewExportJobUsecase, NewGeoScheduler, NewSubscriptionOrderUsecase, NewRealnameUsecase, NewGeoBrandBoardUsecase, NewOpinionScheduler)
