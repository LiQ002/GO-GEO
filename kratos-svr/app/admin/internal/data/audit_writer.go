package data

import (
	"context"
	"encoding/json"
	"fmt"

	"kratos-svr/internal/data/model"

	"github.com/go-kratos/kratos/v3/transport"
	"gorm.io/gorm"
)

func writeAdminAudit(ctx context.Context, tx *gorm.DB, operatorID uint64, action, resourceType, resourceID, result, reason string, before, after any) error {
	beforeJSON, err := marshalAuditValue(before)
	if err != nil {
		return err
	}
	afterJSON, err := marshalAuditValue(after)
	if err != nil {
		return err
	}
	entry := &model.AuditLog{
		ActorType: "admin", ActorID: operatorID, Audience: "geo-admin",
		Action: action, ResourceType: resourceType, ResourceID: resourceID,
		Result: result, Reason: reason, BeforeJSON: beforeJSON, AfterJSON: afterJSON,
	}
	if tr, ok := transport.FromServerContext(ctx); ok {
		entry.RequestID = tr.RequestHeader().Get("X-Request-ID")
		entry.TraceID = tr.RequestHeader().Get("Traceparent")
		entry.IPAddress = tr.RequestHeader().Get("X-Forwarded-For")
		entry.UserAgent = tr.RequestHeader().Get("User-Agent")
	}
	return tx.Create(entry).Error
}

func marshalAuditValue(value any) ([]byte, error) {
	if value == nil {
		return nil, nil
	}
	data, err := json.Marshal(value)
	if err != nil {
		return nil, fmt.Errorf("marshal audit value: %w", err)
	}
	return data, nil
}
