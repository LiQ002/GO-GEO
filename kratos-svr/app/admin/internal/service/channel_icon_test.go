package service

import (
	"bytes"
	"context"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"kratos-svr/app/admin/internal/biz"
	"kratos-svr/app/admin/internal/conf"
)

func TestIconStorageSave(t *testing.T) {
	storage := newTestIconStorage(t, "https://assets.example.com/")
	content := testPNG(t, 32, 32)

	url, err := storage.SavePublishChannelIcon(context.Background(), "logo.png", "image/png", content)
	if err != nil {
		t.Fatalf("Save() error = %v", err)
	}
	if !strings.HasPrefix(url, "https://assets.example.com/uploads/channel-icons/") || !strings.HasSuffix(url, ".png") {
		t.Fatalf("Save() URL = %q", url)
	}

	relativePath := strings.TrimPrefix(url, "https://assets.example.com/uploads/channel-icons/")
	storedContent, err := os.ReadFile(filepath.Join(storage.ChannelDirectory(), filepath.FromSlash(relativePath)))
	if err != nil {
		t.Fatalf("read stored icon: %v", err)
	}
	if !bytes.Equal(storedContent, content) {
		t.Fatal("stored icon content differs from upload")
	}

	duplicateURL, err := storage.SavePublishChannelIcon(context.Background(), "another-name.png", "image/png", content)
	if err != nil {
		t.Fatalf("Save() duplicate error = %v", err)
	}
	if duplicateURL != url {
		t.Fatalf("Save() duplicate URL = %q, want %q", duplicateURL, url)
	}
}

func TestIconStorageSeparatesInclusionSiteIcons(t *testing.T) {
	storage := newTestIconStorage(t, "")
	content := testPNG(t, 16, 16)

	url, err := storage.SaveInclusionSiteIcon(context.Background(), "site.png", "image/png", content)
	if err != nil {
		t.Fatalf("SaveInclusionSiteIcon() error = %v", err)
	}
	if !strings.HasPrefix(url, inclusionSiteIconURLPrefix) {
		t.Fatalf("SaveInclusionSiteIcon() URL = %q", url)
	}
	relativePath := strings.TrimPrefix(url, inclusionSiteIconURLPrefix)
	if _, err := os.Stat(filepath.Join(storage.InclusionSiteDirectory(), filepath.FromSlash(relativePath))); err != nil {
		t.Fatalf("stat stored inclusion-site icon: %v", err)
	}
}

func TestIconStorageRejectsInvalidUploads(t *testing.T) {
	storage := newTestIconStorage(t, "")
	tests := []struct {
		name        string
		filename    string
		contentType string
		content     []byte
	}{
		{name: "empty filename", contentType: "image/png", content: testPNG(t, 1, 1)},
		{name: "non image", filename: "icon.png", contentType: "image/png", content: []byte("not an image")},
		{name: "mismatched type", filename: "icon.jpg", contentType: "image/jpeg", content: testPNG(t, 1, 1)},
		{name: "too large", filename: "icon.png", contentType: "image/png", content: make([]byte, maxIconBytes+1)},
		{name: "dimensions too large", filename: "icon.png", contentType: "image/png", content: testPNG(t, maxIconDimension+1, 1)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := storage.SavePublishChannelIcon(context.Background(), tt.filename, tt.contentType, tt.content)
			if err != biz.ErrPublishChannelIconInvalid {
				t.Fatalf("Save() error = %v, want %v", err, biz.ErrPublishChannelIconInvalid)
			}
		})
	}
}

func newTestIconStorage(t *testing.T, baseURL string) *IconStorage {
	t.Helper()
	storage, err := NewIconStorage(&conf.Server{Http: &conf.Server_HTTP{
		AssetRoot:    t.TempDir(),
		AssetBaseUrl: baseURL,
	}})
	if err != nil {
		t.Fatalf("NewIconStorage() error = %v", err)
	}
	return storage
}

func testPNG(t *testing.T, width, height int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	img.Set(0, 0, color.RGBA{R: 0x16, G: 0x72, B: 0xec, A: 0xff})
	var buffer bytes.Buffer
	if err := png.Encode(&buffer, img); err != nil {
		t.Fatalf("encode test PNG: %v", err)
	}
	return buffer.Bytes()
}
