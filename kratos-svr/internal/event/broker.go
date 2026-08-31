// Package event 提供跨进程事件推送能力（Redis Pub/Sub）。
// admin 进程在任务上报后 Publish 事件，user 进程的 SSE handler Subscribe 后推送给前端。
package event

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
)

// Type 事件类型。
type Type string

const (
	TypeGeoTaskCompleted     Type = "geo_task_completed"
	TypePublishTaskCompleted Type = "publish_task_completed"
)

// Payload 事件载荷。
type Payload struct {
	Type           Type   `json:"type"`
	EnterpriseID   uint64 `json:"enterprise_id"`
	TaskID         uint64 `json:"task_id"`
	Status         string `json:"status"`
	BrandMentioned bool   `json:"brand_mentioned,omitempty"`
}

// Broker 跨进程事件代理。
type Broker struct {
	client *redis.Client
	logger *slog.Logger
}

// NewBroker 创建 Redis 事件代理。
func NewBroker(addr string, logger *slog.Logger) *Broker {
	client := redis.NewClient(&redis.Options{
		Addr:         addr,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
		PoolSize:     10,
	})
	return &Broker{client: client, logger: logger}
}

// Publish 向指定企业的频道发布事件。
func (b *Broker) Publish(ctx context.Context, p Payload) error {
	data, err := json.Marshal(p)
	if err != nil {
		return err
	}
	return b.client.Publish(ctx, channelName(p.EnterpriseID), data).Err()
}

// Subscribe 订阅指定企业的事件流。返回事件 channel 和取消函数。
func (b *Broker) Subscribe(ctx context.Context, enterpriseID uint64) (<-chan Payload, func()) {
	pubsub := b.client.Subscribe(ctx, channelName(enterpriseID))
	ch := make(chan Payload, 16)
	go func() {
		defer close(ch)
		msgCh := pubsub.Channel()
		for msg := range msgCh {
			var p Payload
			if json.Unmarshal([]byte(msg.Payload), &p) == nil {
				select {
				case ch <- p:
				default: // channel 满则丢弃，避免阻塞
				}
			}
		}
	}()
	return ch, func() { _ = pubsub.Close() }
}

// Ping 检查 Redis 连接是否可用。
func (b *Broker) Ping(ctx context.Context) error {
	return b.client.Ping(ctx).Err()
}

func channelName(enterpriseID uint64) string {
	return fmt.Sprintf("geo:events:%d", enterpriseID)
}
