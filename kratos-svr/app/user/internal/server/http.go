package server

import (
	nethttp "net/http"

	"github.com/go-kratos/kratos/v3/middleware/recovery"
	"github.com/go-kratos/kratos/v3/middleware/validate"
	"github.com/go-kratos/kratos/v3/transport/http"
	v1 "kratos-svr/api/user/v1"
	"kratos-svr/app/user/internal/conf"
	"kratos-svr/app/user/internal/data"
	"kratos-svr/app/user/internal/service"
	"kratos-svr/internal/authn"
	"kratos-svr/internal/httpx"

	"go.einride.tech/aip/fieldbehavior"
	"google.golang.org/protobuf/proto"
)

const localUploadURLPrefix = "/api/user/v1/uploads/"

// LocalUploadStorage exposes only the local-directory capability needed by
// HTTP infrastructure. OSS-backed storage reports false.
type LocalUploadStorage interface {
	LocalDirectory() (string, bool)
}

// NewHTTPServer new an HTTP server.
func NewHTTPServer(c *conf.Server, authManager *authn.Manager, auth *service.AuthService, brand *service.BrandService, knowledge *service.KnowledgeService, gallery *service.GalleryService, keyword *service.KeywordService, question *service.QuestionService, catalog *service.CatalogService, article *service.ArticleService, articleGeneration *service.ArticleGenerationService, platformAccount *service.PlatformAccountService, clientAuth *service.ClientAuthorizationService, publishTask *service.PublishTaskService, geoMonitor *service.GeoMonitorService, geoReport *service.GeoReportService, brandBoard *service.GeoBrandBoardService, notification *service.NotificationService, exportJob *service.ExportJobService, subscriptionOrder *service.SubscriptionOrderService, realname *service.RealnameService, uploads LocalUploadStorage, dataData *data.Data) *http.Server {
	var opts = []http.ServerOption{
		http.Filter(httpx.CORS(c.Http.GetCorsAllowedOrigins())),
		http.RequestDecoder(httpx.ProtoJSONRequestDecoder),
		http.ResponseEncoder(httpx.ProtoJSONResponseEncoder),
		http.Middleware(
			recovery.Recovery(),
			validate.Validator(func(req any) error {
				if msg, ok := req.(proto.Message); ok {
					if err := fieldbehavior.ValidateRequiredFields(msg); err != nil {
						return err
					}
				}
				return nil
			}),
			authn.Middleware(authManager, "/user.v1.AuthService/Login", "/user.v1.AuthService/Refresh", "/user.v1.ClientAuthorizationService/SubmitAuthorization", "/user.v1.ClientAuthorizationService/ReportAuthorizationHeartbeat"),
		),
	}
	if c.Http.Network != "" {
		opts = append(opts, http.Network(c.Http.Network))
	}
	if c.Http.Addr != "" {
		opts = append(opts, http.Address(c.Http.Addr))
	}
	if c.Http.Timeout != nil {
		opts = append(opts, http.Timeout(c.Http.Timeout.AsDuration()))
	}
	srv := http.NewServer(opts...)
	registerLocalUploadHandler(srv, uploads)
	registerLegacyEnterpriseHandlers(srv, dataData, auth, authManager)
	registerSSEHandler(srv, dataData, authManager, authManager.CookieName())
	v1.RegisterAuthServiceHTTPServer(srv, auth)
	v1.RegisterBrandServiceHTTPServer(srv, brand)
	v1.RegisterKnowledgeServiceHTTPServer(srv, knowledge)
	v1.RegisterGalleryServiceHTTPServer(srv, gallery)
	v1.RegisterKeywordServiceHTTPServer(srv, keyword)
	v1.RegisterQuestionServiceHTTPServer(srv, question)
	v1.RegisterCatalogServiceHTTPServer(srv, catalog)
	v1.RegisterArticleServiceHTTPServer(srv, article)
	v1.RegisterArticleGenerationServiceHTTPServer(srv, articleGeneration)
	v1.RegisterPlatformAccountServiceHTTPServer(srv, platformAccount)
	v1.RegisterClientAuthorizationServiceHTTPServer(srv, clientAuth)
	v1.RegisterPublishTaskServiceHTTPServer(srv, publishTask)
	v1.RegisterGeoMonitorServiceHTTPServer(srv, geoMonitor)
	v1.RegisterGeoReportServiceHTTPServer(srv, geoReport)
	v1.RegisterGeoBrandBoardServiceHTTPServer(srv, brandBoard)
	v1.RegisterNotificationServiceHTTPServer(srv, notification)
	v1.RegisterExportJobServiceHTTPServer(srv, exportJob)
	v1.RegisterSubscriptionOrderServiceHTTPServer(srv, subscriptionOrder)
	v1.RegisterRealnameServiceHTTPServer(srv, realname)
	return srv
}

func registerLegacyEnterpriseHandlers(srv *http.Server, dataData *data.Data, auth *service.AuthService, manager *authn.Manager) {
	(&legacyEnterpriseHandler{data: dataData, auth: auth, authn: manager}).Register(srv.Route("/"))
}

func registerLocalUploadHandler(srv *http.Server, storage LocalUploadStorage) {
	directory, ok := storage.LocalDirectory()
	if !ok {
		return
	}
	files := nethttp.StripPrefix(localUploadURLPrefix, nethttp.FileServer(nethttp.Dir(directory)))
	srv.HandlePrefix(localUploadURLPrefix, nethttp.HandlerFunc(func(w nethttp.ResponseWriter, r *nethttp.Request) {
		if r.Method != nethttp.MethodGet && r.Method != nethttp.MethodHead {
			w.WriteHeader(nethttp.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		files.ServeHTTP(w, r)
	}))
}
