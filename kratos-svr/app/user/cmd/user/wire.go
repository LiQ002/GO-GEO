//go:build wireinject
// +build wireinject

// The build tag makes sure the stub is not built in the final build.

package main

import (
	"log/slog"

	"kratos-svr/app/user/internal/biz"
	"kratos-svr/app/user/internal/conf"
	"kratos-svr/app/user/internal/data"
	"kratos-svr/app/user/internal/server"
	"kratos-svr/app/user/internal/service"
	"kratos-svr/internal/authn"

	"github.com/go-kratos/kratos/v3"
	"github.com/google/wire"
)

// wireApp init kratos application.
func wireApp(*conf.Server, *conf.Data, *conf.Auth, *conf.Storage, *slog.Logger) (*kratos.App, func(), error) {
	panic(wire.Build(
		server.ProviderSet,
		data.ProviderSet,
		biz.ProviderSet,
		service.ProviderSet,
		newAuthManager,
		wire.Bind(new(biz.TokenManager), new(*authn.Manager)),
		wire.Bind(new(server.LocalUploadStorage), new(*data.FileStorage)),
		newApp,
	))
}
