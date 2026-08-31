package server

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"kratos-svr/app/user/internal/data"
	"kratos-svr/internal/authn"

	nethttp "net/http"

	"github.com/go-kratos/kratos/v3/transport/http"
)

// sseHandler 处理 SSE 连接，将 Redis 订阅的事件推送给前端。
type sseHandler struct {
	data       *data.Data
	authn      *authn.Manager
	cookieName string
}

// registerSSEHandler 注册 SSE 路由。
func registerSSEHandler(srv *http.Server, dataData *data.Data, manager *authn.Manager, cookieName string) {
	if dataData == nil || dataData.Broker() == nil {
		return // Redis 不可用时跳过注册
	}
	h := &sseHandler{data: dataData, authn: manager, cookieName: cookieName}
	srv.HandlePrefix("/api/user/v1/events/stream", nethttp.HandlerFunc(h.serve))
}

func (h *sseHandler) serve(w nethttp.ResponseWriter, r *nethttp.Request) {
	// 从 Cookie 或 Authorization header 鉴权（EventSource 不支持自定义 Header）
	token := h.extractToken(r)
	if token == "" {
		nethttp.Error(w, "authentication required", nethttp.StatusUnauthorized)
		return
	}
	claims, err := h.authn.Verify(token, authn.TokenKindAccess)
	if err != nil {
		nethttp.Error(w, "invalid or expired token", nethttp.StatusUnauthorized)
		return
	}
	if claims.EnterpriseID == 0 {
		nethttp.Error(w, "enterprise context required", nethttp.StatusForbidden)
		return
	}

	// SSE 响应头
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // Nginx 关闭缓冲

	flusher, ok := w.(nethttp.Flusher)
	if !ok {
		nethttp.Error(w, "streaming not supported", nethttp.StatusInternalServerError)
		return
	}

	// 发送初始连接确认
	fmt.Fprintf(w, "event: connected\ndata: {\"enterprise_id\":%d}\n\n", claims.EnterpriseID)
	flusher.Flush()

	// 订阅该企业的事件
	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	eventCh, unsub := h.data.Broker().Subscribe(ctx, claims.EnterpriseID)
	defer unsub()

	// 心跳定时器，防止代理超时断开
	heartbeat := time.NewTicker(15 * time.Second)
	defer heartbeat.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-heartbeat.C:
			// SSE 注释行作为心跳
			_, err := fmt.Fprintf(w, ":keepalive\n\n")
			if err != nil {
				return
			}
			flusher.Flush()
		case evt, ok := <-eventCh:
			if !ok {
				return
			}
			data, _ := json.Marshal(evt)
			_, err := fmt.Fprintf(w, "event: %s\ndata: %s\n\n", evt.Type, data)
			if err != nil {
				return
			}
			flusher.Flush()
		}
	}
}

func (h *sseHandler) extractToken(r *nethttp.Request) string {
	// 优先 Authorization header
	authHeader := r.Header.Get("Authorization")
	if authHeader != "" {
		fields := strings.Fields(authHeader)
		if len(fields) == 2 && strings.EqualFold(fields[0], "Bearer") {
			return fields[1]
		}
	}
	// 回退到 Cookie（EventSource 场景）
	if cookie, err := r.Cookie(h.cookieName); err == nil {
		return cookie.Value
	}
	return ""
}
