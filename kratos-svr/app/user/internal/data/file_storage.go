package data

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"

	"kratos-svr/app/user/internal/conf"

	"github.com/aliyun/alibabacloud-oss-go-sdk-v2/oss"
	"github.com/aliyun/alibabacloud-oss-go-sdk-v2/oss/credentials"
)

const (
	fileStorageDriverLocal     = "local"
	fileStorageDriverAliyunOSS = "aliyun_oss"
	localUploadURLPrefix       = "/api/user/v1/uploads/"
	defaultLocalStorageRoot    = "./storage/user-assets"
)

type fileStorageDriver interface {
	Delete(context.Context, string) error
	PublicURL(string) string
	Put(context.Context, string, string, []byte) error
}

// FileStorage is the application-wide persistence boundary for user-uploaded
// files. Database repositories store only the returned object key.
type FileStorage struct {
	driver     fileStorageDriver
	localRoot  string
	pathPrefix string
}

func NewFileStorage(config *conf.Storage) (*FileStorage, error) {
	driverName := fileStorageDriverLocal
	if config != nil && strings.TrimSpace(config.GetDriver()) != "" {
		driverName = strings.ToLower(strings.TrimSpace(config.GetDriver()))
	}
	switch driverName {
	case fileStorageDriverLocal:
		return newLocalFileStorage(config)
	case fileStorageDriverAliyunOSS:
		return newAliyunOSSFileStorage(config)
	default:
		return nil, fmt.Errorf("unsupported user file storage driver %q", driverName)
	}
}

func (s *FileStorage) Put(ctx context.Context, logicalKey, contentType string, content []byte) (string, error) {
	key, err := normalizeObjectKey(logicalKey)
	if err != nil {
		return "", err
	}
	if s.pathPrefix != "" {
		key = s.pathPrefix + "/" + key
	}
	if err := s.driver.Put(ctx, key, contentType, content); err != nil {
		return "", err
	}
	return key, nil
}

func (s *FileStorage) Delete(ctx context.Context, objectKey string) error {
	key, err := normalizeObjectKey(objectKey)
	if err != nil {
		return err
	}
	return s.driver.Delete(ctx, key)
}

func (s *FileStorage) PublicURL(objectKey string) string {
	key, err := normalizeObjectKey(objectKey)
	if err != nil {
		return ""
	}
	return s.driver.PublicURL(key)
}

// LocalDirectory exposes the local driver root for the HTTP static-file
// handler. OSS-backed storage returns false.
func (s *FileStorage) LocalDirectory() (string, bool) {
	return s.localRoot, s.localRoot != ""
}

type localFileStorage struct {
	baseURL string
	root    string
}

func newLocalFileStorage(config *conf.Storage) (*FileStorage, error) {
	root := defaultLocalStorageRoot
	baseURL := ""
	if config != nil && config.GetLocal() != nil {
		if configuredRoot := strings.TrimSpace(config.GetLocal().GetRoot()); configuredRoot != "" {
			root = configuredRoot
		}
		baseURL = strings.TrimRight(strings.TrimSpace(config.GetLocal().GetPublicBaseUrl()), "/")
	}
	absoluteRoot, err := filepath.Abs(root)
	if err != nil {
		return nil, fmt.Errorf("resolve local user file storage root: %w", err)
	}
	if err := os.MkdirAll(absoluteRoot, 0o750); err != nil {
		return nil, fmt.Errorf("create local user file storage root: %w", err)
	}
	driver := &localFileStorage{baseURL: baseURL, root: absoluteRoot}
	return &FileStorage{driver: driver, localRoot: absoluteRoot}, nil
}

func (s *localFileStorage) Put(ctx context.Context, key, _ string, content []byte) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	target, err := s.objectPath(key)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(target), 0o750); err != nil {
		return fmt.Errorf("create local object directory: %w", err)
	}
	file, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o640)
	if err != nil {
		return fmt.Errorf("create local object: %w", err)
	}
	removeIncomplete := true
	defer func() {
		if removeIncomplete {
			_ = os.Remove(target)
		}
	}()
	if _, err := file.Write(content); err != nil {
		_ = file.Close()
		return fmt.Errorf("write local object: %w", err)
	}
	if err := file.Sync(); err != nil {
		_ = file.Close()
		return fmt.Errorf("sync local object: %w", err)
	}
	if err := file.Close(); err != nil {
		return fmt.Errorf("close local object: %w", err)
	}
	removeIncomplete = false
	return nil
}

func (s *localFileStorage) Delete(ctx context.Context, key string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	target, err := s.objectPath(key)
	if err != nil {
		return err
	}
	if err := os.Remove(target); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("delete local object: %w", err)
	}
	return nil
}

func (s *localFileStorage) PublicURL(key string) string {
	objectURL := localUploadURLPrefix + escapeObjectKey(key)
	return s.baseURL + objectURL
}

func (s *localFileStorage) objectPath(key string) (string, error) {
	normalized, err := normalizeObjectKey(key)
	if err != nil {
		return "", err
	}
	target := filepath.Join(s.root, filepath.FromSlash(normalized))
	relative, err := filepath.Rel(s.root, target)
	if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
		return "", errors.New("object key escapes local storage root")
	}
	return target, nil
}

type aliyunOSSFileStorage struct {
	baseURL string
	bucket  string
	client  *oss.Client
}

func newAliyunOSSFileStorage(config *conf.Storage) (*FileStorage, error) {
	if config == nil || config.GetAliyunOss() == nil {
		return nil, errors.New("aliyun OSS storage config is required")
	}
	settings := config.GetAliyunOss()
	region := strings.TrimSpace(settings.GetRegion())
	bucket := strings.TrimSpace(settings.GetBucket())
	accessKeyID := strings.TrimSpace(settings.GetAccessKeyId())
	accessKeySecret := strings.TrimSpace(settings.GetAccessKeySecret())
	if region == "" || bucket == "" {
		return nil, errors.New("aliyun OSS region and bucket are required")
	}
	if (accessKeyID == "") != (accessKeySecret == "") {
		return nil, errors.New("aliyun OSS access key id and secret must be configured together")
	}
	var provider credentials.CredentialsProvider
	if accessKeyID == "" {
		provider = credentials.NewEnvironmentVariableCredentialsProvider()
	} else {
		token := strings.TrimSpace(settings.GetSecurityToken())
		if token == "" {
			provider = credentials.NewStaticCredentialsProvider(accessKeyID, accessKeySecret)
		} else {
			provider = credentials.NewStaticCredentialsProvider(accessKeyID, accessKeySecret, token)
		}
	}
	ossConfig := oss.LoadDefaultConfig().
		WithCredentialsProvider(provider).
		WithRegion(region)
	if endpoint := strings.TrimSpace(settings.GetEndpoint()); endpoint != "" {
		if endpointRegion := aliyunOSSRegionFromEndpoint(endpoint); endpointRegion != "" && !strings.EqualFold(endpointRegion, region) {
			return nil, fmt.Errorf("aliyun OSS endpoint region %q does not match configured region %q", endpointRegion, region)
		}
		ossConfig.WithEndpoint(endpoint)
	}
	baseURL := strings.TrimRight(strings.TrimSpace(settings.GetPublicBaseUrl()), "/")
	if baseURL == "" {
		baseURL = "https://" + bucket + ".oss-" + region + ".aliyuncs.com"
	}
	pathPrefix := strings.Trim(strings.TrimSpace(settings.GetPathPrefix()), "/")
	if pathPrefix != "" {
		var err error
		pathPrefix, err = normalizeObjectKey(pathPrefix)
		if err != nil {
			return nil, fmt.Errorf("invalid aliyun OSS path prefix: %w", err)
		}
	}
	driver := &aliyunOSSFileStorage{
		baseURL: baseURL,
		bucket:  bucket,
		client:  oss.NewClient(ossConfig),
	}
	return &FileStorage{
		driver:     driver,
		pathPrefix: pathPrefix,
	}, nil
}

func (s *aliyunOSSFileStorage) Put(ctx context.Context, key, contentType string, content []byte) error {
	length := int64(len(content))
	cacheControl := "public, max-age=31536000, immutable"
	forbidOverwrite := "true"
	_, err := s.client.PutObject(ctx, &oss.PutObjectRequest{
		Bucket:          oss.Ptr(s.bucket),
		Key:             oss.Ptr(key),
		Body:            bytes.NewReader(content),
		ContentLength:   &length,
		ContentType:     oss.Ptr(contentType),
		CacheControl:    &cacheControl,
		ForbidOverwrite: &forbidOverwrite,
	})
	if err != nil {
		return fmt.Errorf("put aliyun OSS object: %w", err)
	}
	return nil
}

func (s *aliyunOSSFileStorage) Delete(ctx context.Context, key string) error {
	if _, err := s.client.DeleteObject(ctx, &oss.DeleteObjectRequest{
		Bucket: oss.Ptr(s.bucket),
		Key:    oss.Ptr(key),
	}); err != nil {
		return fmt.Errorf("delete aliyun OSS object: %w", err)
	}
	return nil
}

func (s *aliyunOSSFileStorage) PublicURL(key string) string {
	return s.baseURL + "/" + escapeObjectKey(key)
}

func normalizeObjectKey(value string) (string, error) {
	raw := strings.TrimSpace(value)
	if raw == "" || path.IsAbs(raw) {
		return "", errors.New("invalid object key")
	}
	for _, segment := range strings.Split(raw, "/") {
		if segment == "" || segment == "." || segment == ".." {
			return "", errors.New("invalid object key")
		}
	}
	normalized := path.Clean(raw)
	return normalized, nil
}

func escapeObjectKey(key string) string {
	parts := strings.Split(key, "/")
	for i := range parts {
		parts[i] = url.PathEscape(parts[i])
	}
	return strings.Join(parts, "/")
}

func aliyunOSSRegionFromEndpoint(endpoint string) string {
	raw := strings.TrimSpace(endpoint)
	if raw == "" {
		return ""
	}
	if !strings.Contains(raw, "://") {
		raw = "https://" + raw
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	host := strings.ToLower(parsed.Hostname())
	if !strings.HasSuffix(host, ".aliyuncs.com") {
		return ""
	}
	host = strings.TrimSuffix(host, ".aliyuncs.com")
	if index := strings.LastIndex(host, ".oss-"); index >= 0 {
		host = host[index+1:]
	}
	if !strings.HasPrefix(host, "oss-") {
		return ""
	}
	region := strings.TrimSuffix(strings.TrimPrefix(host, "oss-"), "-internal")
	for _, prefix := range []string{"cn-", "ap-", "eu-", "us-", "me-"} {
		if strings.HasPrefix(region, prefix) {
			return region
		}
	}
	return ""
}
