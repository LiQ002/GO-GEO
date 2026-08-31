package server

import (
	v1 "kratos-svr/api/user/v1"
	"kratos-svr/app/user/internal/conf"
	"kratos-svr/app/user/internal/service"
	"kratos-svr/internal/authn"

	"github.com/go-kratos/kratos/v3/middleware/recovery"
	"github.com/go-kratos/kratos/v3/transport/grpc"
)

// NewGRPCServer new a gRPC server.
func NewGRPCServer(c *conf.Server, authManager *authn.Manager, auth *service.AuthService, brand *service.BrandService, knowledge *service.KnowledgeService, gallery *service.GalleryService, keyword *service.KeywordService, question *service.QuestionService, catalog *service.CatalogService, article *service.ArticleService, articleGeneration *service.ArticleGenerationService, platformAccount *service.PlatformAccountService, clientAuth *service.ClientAuthorizationService, publishTask *service.PublishTaskService, geoMonitor *service.GeoMonitorService, geoReport *service.GeoReportService, notification *service.NotificationService, exportJob *service.ExportJobService, subscriptionOrder *service.SubscriptionOrderService) *grpc.Server {
	var opts = []grpc.ServerOption{
		grpc.Middleware(
			recovery.Recovery(),
			authn.Middleware(authManager, "/user.v1.AuthService/Login", "/user.v1.AuthService/Refresh", "/user.v1.ClientAuthorizationService/SubmitAuthorization", "/user.v1.ClientAuthorizationService/ReportAuthorizationHeartbeat"),
		),
	}
	if c.Grpc.Network != "" {
		opts = append(opts, grpc.Network(c.Grpc.Network))
	}
	if c.Grpc.Addr != "" {
		opts = append(opts, grpc.Address(c.Grpc.Addr))
	}
	if c.Grpc.Timeout != nil {
		opts = append(opts, grpc.Timeout(c.Grpc.Timeout.AsDuration()))
	}
	srv := grpc.NewServer(opts...)
	v1.RegisterAuthServiceServer(srv, auth)
	v1.RegisterBrandServiceServer(srv, brand)
	v1.RegisterKnowledgeServiceServer(srv, knowledge)
	v1.RegisterGalleryServiceServer(srv, gallery)
	v1.RegisterKeywordServiceServer(srv, keyword)
	v1.RegisterQuestionServiceServer(srv, question)
	v1.RegisterCatalogServiceServer(srv, catalog)
	v1.RegisterArticleServiceServer(srv, article)
	v1.RegisterArticleGenerationServiceServer(srv, articleGeneration)
	v1.RegisterPlatformAccountServiceServer(srv, platformAccount)
	v1.RegisterClientAuthorizationServiceServer(srv, clientAuth)
	v1.RegisterPublishTaskServiceServer(srv, publishTask)
	v1.RegisterGeoMonitorServiceServer(srv, geoMonitor)
	v1.RegisterGeoReportServiceServer(srv, geoReport)
	v1.RegisterNotificationServiceServer(srv, notification)
	v1.RegisterExportJobServiceServer(srv, exportJob)
	v1.RegisterSubscriptionOrderServiceServer(srv, subscriptionOrder)
	return srv
}
