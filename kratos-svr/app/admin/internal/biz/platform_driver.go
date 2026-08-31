package biz

import (
	"net/url"
	"strings"
)

const (
	MediaDriverWechat int32 = iota + 1
	MediaDriverZhihu
	MediaDriverToutiao
	MediaDriverWeibo
	MediaDriverBaijiahao
	MediaDriverXiaohongshu
	MediaDriverNetease
	MediaDriverSohu
	MediaDriverQqnews
	MediaDriverJianshu
	MediaDriverCsdn
)

const (
	ModelDriverDeepSeek int32 = iota + 1
	ModelDriverQianwen
	ModelDriverDoubao
	ModelDriverYuanbao
	ModelDriverWenxin
	ModelDriverNami
	ModelDriverKimi
	ModelDriverZhipu
)

func validPlatformLoginURL(value string) bool {
	u, err := url.ParseRequestURI(strings.TrimSpace(value))
	return err == nil && u.Host != "" && (u.Scheme == "https" || u.Scheme == "http")
}
