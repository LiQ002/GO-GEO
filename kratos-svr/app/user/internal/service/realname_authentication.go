package service

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"mime"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"

	v1 "kratos-svr/api/user/v1"
	"kratos-svr/app/user/internal/biz"
	"kratos-svr/app/user/internal/data"
	"kratos-svr/internal/authn"
)

type RealnameService struct {
	v1.UnimplementedRealnameServiceServer
	uc      *biz.RealnameUsecase
	storage *data.FileStorage
}

func NewRealnameService(uc *biz.RealnameUsecase, storage *data.FileStorage) *RealnameService {
	return &RealnameService{uc: uc, storage: storage}
}

func (s *RealnameService) SubmitRealnameAuthentication(ctx context.Context, req *v1.SubmitRealnameAuthenticationRequest) (*v1.RealnameAuthentication, error) {
	enterpriseID, err := authn.RequireEnterprise(ctx)
	if err != nil {
		return nil, err
	}

	item, err := s.uc.Submit(ctx, biz.RealnameSubmitCommand{
		Type:            req.GetType(),
		RealName:        req.GetRealName(),
		IDCardNumber:    req.GetIdCardNumber(),
		Mobile:          req.GetMobile(),
		CompanyName:     req.GetCompanyName(),
		RegistrationNo:  req.GetRegistrationNo(),
		LicenseImageURL: req.GetLicenseImageUrl(),
		IDCardImageURL:  req.GetIdCardImageUrl(),
		EnterpriseID:    enterpriseID,
	})
	if err != nil {
		return nil, err
	}
	return realnameDTO(item), nil
}

func (s *RealnameService) GetMyRealnameAuthentication(ctx context.Context, req *v1.GetMyRealnameAuthenticationRequest) (*v1.RealnameAuthentication, error) {
	enterpriseID, err := authn.RequireEnterprise(ctx)
	if err != nil {
		return nil, err
	}

	item, err := s.uc.GetMine(ctx, enterpriseID)
	if err != nil {
		return nil, err
	}
	return realnameDTO(item), nil
}

func (s *RealnameService) UploadRealnameImage(ctx context.Context, req *v1.UploadRealnameImageRequest) (*v1.UploadRealnameImageReply, error) {
	enterpriseID, err := authn.RequireEnterprise(ctx)
	if err != nil {
		return nil, err
	}

	content := req.GetContent()
	if content == "" {
		return nil, errors.New("content is required")
	}

	imageData, err := decodeBase64Image(content)
	if err != nil {
		return nil, fmt.Errorf("invalid image content: %w", err)
	}

	mimeType := req.GetMimeType()
	if mimeType == "" {
		detectedType := http.DetectContentType(imageData)
		mediaType, _, err := mime.ParseMediaType(detectedType)
		if err != nil {
			return nil, fmt.Errorf("detect mime type failed: %w", err)
		}
		mimeType = mediaType
	}

	if !isValidImageType(mimeType) {
		return nil, fmt.Errorf("unsupported image type: %s", mimeType)
	}

	originalName := req.GetOriginalName()
	ext := filepath.Ext(originalName)
	if ext == "" {
		ext = ".jpg"
	}

	objectKey := fmt.Sprintf("realname/%d/%s%s", enterpriseID, generateRandomKey(), ext)

	storedKey, err := s.storage.Put(ctx, objectKey, mimeType, imageData)
	if err != nil {
		return nil, fmt.Errorf("upload to storage failed: %w", err)
	}

	publicURL := s.storage.PublicURL(storedKey)

	return &v1.UploadRealnameImageReply{
		Url:       publicURL,
		ObjectKey: storedKey,
	}, nil
}

func decodeBase64Image(base64Str string) ([]byte, error) {
	base64Str = strings.TrimSpace(base64Str)
	if strings.HasPrefix(base64Str, "data:") {
		if idx := strings.Index(base64Str, "base64,"); idx != -1 {
			base64Str = base64Str[idx+7:]
		}
	}
	return base64Decode(base64Str)
}

func generateRandomKey() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func isValidImageType(mimeType string) bool {
	switch strings.ToLower(strings.TrimSpace(mimeType)) {
	case "image/jpeg", "image/png", "image/gif", "image/webp":
		return true
	default:
		return false
	}
}

func base64Decode(s string) ([]byte, error) {
	return base64.StdEncoding.DecodeString(s)
}

func realnameDTO(item *biz.RealnameAuthentication) *v1.RealnameAuthentication {
	if item == nil {
		return nil
	}
	var reviewedBy uint64
	if item.ReviewedBy != nil {
		reviewedBy = *item.ReviewedBy
	}
	return &v1.RealnameAuthentication{
		Id:              item.ID,
		EnterpriseId:    item.EnterpriseID,
		Type:            item.Type,
		Status:          item.Status,
		RealName:        item.RealName,
		IdCardNumber:    item.IDCardNumber,
		Mobile:          item.Mobile,
		CompanyName:     item.CompanyName,
		RegistrationNo: item.RegistrationNo,
		LicenseImageUrl: item.LicenseImageURL,
		IdCardImageUrl:  item.IDCardImageURL,
		RejectReason:    item.RejectReason,
		ReviewedBy:      reviewedBy,
		ReviewedAt:      timestampProto(item.ReviewedAt),
		SubmittedAt:     timestamppb.New(item.SubmittedAt),
	}
}

func timestampProto(t *time.Time) *timestamppb.Timestamp {
	if t == nil {
		return nil
	}
	return timestamppb.New(*t)
}
