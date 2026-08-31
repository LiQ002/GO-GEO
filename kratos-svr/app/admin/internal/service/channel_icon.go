package service

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/app/admin/internal/conf"
)

const (
	maxIconBytes               = 2 << 20
	maxIconDimension           = 2048
	channelIconDirectoryName   = "channel-icons"
	inclusionIconDirectoryName = "inclusion-site-icons"
	channelIconURLPrefix       = "/uploads/channel-icons/"
	inclusionSiteIconURLPrefix = "/uploads/inclusion-site-icons/"
)

var iconExtensions = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
}

// IconStorage stores validated configuration icons in isolated public directories.
type IconStorage struct {
	rootDirectory string
	baseURL       string
}

func NewIconStorage(server *conf.Server) (*IconStorage, error) {
	if server == nil || server.GetHttp() == nil {
		return nil, errors.New("admin HTTP asset storage config is required")
	}
	root := strings.TrimSpace(server.GetHttp().GetAssetRoot())
	if root == "" {
		root = "./storage"
	}
	absoluteRoot, err := filepath.Abs(root)
	if err != nil {
		return nil, errors.New("resolve admin asset storage root")
	}
	for _, directory := range []string{channelIconDirectoryName, inclusionIconDirectoryName} {
		if err := os.MkdirAll(filepath.Join(absoluteRoot, directory), 0o750); err != nil {
			return nil, errors.New("create icon storage root")
		}
	}
	return &IconStorage{
		rootDirectory: absoluteRoot,
		baseURL:       strings.TrimRight(strings.TrimSpace(server.GetHttp().GetAssetBaseUrl()), "/"),
	}, nil
}

// ChannelDirectory returns the absolute publish-channel icon directory.
func (s *IconStorage) ChannelDirectory() string {
	return filepath.Join(s.rootDirectory, channelIconDirectoryName)
}

// InclusionSiteDirectory returns the absolute GEO-site icon directory.
func (s *IconStorage) InclusionSiteDirectory() string {
	return filepath.Join(s.rootDirectory, inclusionIconDirectoryName)
}

// SavePublishChannelIcon validates and stores a publish-channel icon.
func (s *IconStorage) SavePublishChannelIcon(ctx context.Context, filename, declaredContentType string, content []byte) (string, error) {
	return s.save(ctx, channelIconDirectoryName, channelIconURLPrefix, filename, declaredContentType, content, biz.ErrPublishChannelIconInvalid, biz.ErrPublishChannelIconStorage)
}

// SaveInclusionSiteIcon validates and stores a GEO-site icon.
func (s *IconStorage) SaveInclusionSiteIcon(ctx context.Context, filename, declaredContentType string, content []byte) (string, error) {
	return s.save(ctx, inclusionIconDirectoryName, inclusionSiteIconURLPrefix, filename, declaredContentType, content, biz.ErrInclusionSiteIconInvalid, biz.ErrInclusionSiteIconStorage)
}

func (s *IconStorage) save(ctx context.Context, directoryName, urlPrefix, filename, declaredContentType string, content []byte, invalidError, storageError error) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}
	if strings.TrimSpace(filename) == "" || len(content) == 0 || len(content) > maxIconBytes {
		return "", invalidError
	}
	detectedContentType := http.DetectContentType(content)
	extension, allowed := iconExtensions[detectedContentType]
	if !allowed || !matchesDeclaredContentType(declaredContentType, detectedContentType) {
		return "", invalidError
	}
	imageConfig, _, err := image.DecodeConfig(bytes.NewReader(content))
	if err != nil || imageConfig.Width <= 0 || imageConfig.Height <= 0 || imageConfig.Width > maxIconDimension || imageConfig.Height > maxIconDimension {
		return "", invalidError
	}

	digest := sha256.Sum256(content)
	hash := hex.EncodeToString(digest[:])
	shard := hash[:2]
	directory := filepath.Join(s.rootDirectory, directoryName, shard)
	if err := os.MkdirAll(directory, 0o750); err != nil {
		return "", storageError
	}
	storedName := hash + extension
	storedPath := filepath.Join(directory, storedName)
	file, err := os.OpenFile(storedPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o640)
	if errors.Is(err, os.ErrExist) {
		return s.publicURL(urlPrefix, shard, storedName), nil
	}
	if err != nil {
		return "", storageError
	}
	removeIncomplete := true
	defer func() {
		if removeIncomplete {
			_ = os.Remove(storedPath)
		}
	}()
	if _, err := file.Write(content); err != nil {
		_ = file.Close()
		return "", storageError
	}
	if err := file.Sync(); err != nil {
		_ = file.Close()
		return "", storageError
	}
	if err := file.Close(); err != nil {
		return "", storageError
	}
	removeIncomplete = false
	return s.publicURL(urlPrefix, shard, storedName), nil
}

func (s *IconStorage) publicURL(urlPrefix, shard, storedName string) string {
	path := urlPrefix + shard + "/" + storedName
	if s.baseURL == "" {
		return path
	}
	return s.baseURL + path
}

func matchesDeclaredContentType(declared, detected string) bool {
	if strings.TrimSpace(declared) == "" {
		return true
	}
	mediaType, _, err := mime.ParseMediaType(declared)
	if err != nil {
		return false
	}
	if mediaType == "image/jpg" {
		mediaType = "image/jpeg"
	}
	return mediaType == detected
}
