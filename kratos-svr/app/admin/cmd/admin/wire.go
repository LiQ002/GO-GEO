//go:build wireinject
// +build wireinject

// The build tag makes sure the stub is not built in the final build.

package main

import (
	"log/slog"

	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/app/admin/internal/conf"
	"kratos-svr/app/admin/internal/data"
	"kratos-svr/app/admin/internal/server"
	"kratos-svr/app/admin/internal/service"
	"kratos-svr/internal/authn"

	"github.com/go-kratos/kratos/v3"
	"github.com/google/wire"
)

// wireApp init kratos application.
func wireApp(*conf.Server, *conf.Data, *conf.Auth, *slog.Logger) (*kratos.App, func(), error) {
	panic(wire.Build(server.ProviderSet, data.ProviderSet, biz.ProviderSet, service.ProviderSet, newAuthManager, wire.Bind(new(biz.AdminTokenManager), new(*authn.Manager)), newApp))
}
