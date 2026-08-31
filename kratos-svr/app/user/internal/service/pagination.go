package service

import "kratos-svr/internal/query"

const defaultUserPageSize int32 = 10

func parseUserPage(pageSize int32, pageToken string) (query.Page, error) {
	if pageSize <= 0 {
		pageSize = defaultUserPageSize
	}
	return query.ParsePage(pageSize, pageToken)
}
