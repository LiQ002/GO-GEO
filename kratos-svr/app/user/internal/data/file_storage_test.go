package data

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"kratos-svr/app/user/internal/conf"
)

func TestLocalFileStoragePutDeleteAndURL(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	storage, err := NewFileStorage(&conf.Storage{
		Driver: fileStorageDriverLocal,
		Local:  &conf.Storage_Local{Root: root, PublicBaseUrl: "https://assets.example.com/"},
	})
	if err != nil {
		t.Fatal(err)
	}
	key, err := storage.Put(context.Background(), "gallery/7/example.png", "image/png", []byte("image-content"))
	if err != nil {
		t.Fatal(err)
	}
	if key != "gallery/7/example.png" {
		t.Fatalf("object key = %q", key)
	}
	if got := storage.PublicURL(key); got != "https://assets.example.com"+localUploadURLPrefix+"gallery/7/example.png" {
		t.Fatalf("public URL = %q", got)
	}
	stored, err := os.ReadFile(filepath.Join(root, filepath.FromSlash(key)))
	if err != nil {
		t.Fatal(err)
	}
	if string(stored) != "image-content" {
		t.Fatalf("stored content = %q", stored)
	}
	if err := storage.Delete(context.Background(), key); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(root, filepath.FromSlash(key))); !os.IsNotExist(err) {
		t.Fatalf("deleted object still exists: %v", err)
	}
}

func TestFileStorageRejectsUnsafeKeys(t *testing.T) {
	t.Parallel()

	storage, err := NewFileStorage(&conf.Storage{
		Driver: fileStorageDriverLocal,
		Local:  &conf.Storage_Local{Root: t.TempDir()},
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"", ".", "..", "../outside.png", "/absolute.png", "gallery//image.png"} {
		if _, err := storage.Put(context.Background(), key, "image/png", []byte("x")); err == nil {
			t.Fatalf("Put(%q) did not reject unsafe key", key)
		}
	}
}

func TestAliyunOSSStorageValidatesConfig(t *testing.T) {
	t.Parallel()

	_, err := NewFileStorage(&conf.Storage{
		Driver: fileStorageDriverAliyunOSS,
		AliyunOss: &conf.Storage_AliyunOSS{
			Region:      "cn-hangzhou",
			Bucket:      "gallery",
			AccessKeyId: "only-id",
		},
	})
	if err == nil || !strings.Contains(err.Error(), "configured together") {
		t.Fatalf("NewFileStorage() error = %v", err)
	}
}

func TestAliyunOSSStorageRejectsEndpointRegionMismatch(t *testing.T) {
	t.Parallel()

	_, err := NewFileStorage(&conf.Storage{
		Driver: fileStorageDriverAliyunOSS,
		AliyunOss: &conf.Storage_AliyunOSS{
			Region:          "cn-hangzhou",
			Endpoint:        "oss-cn-beijing.aliyuncs.com",
			Bucket:          "gallery",
			AccessKeyId:     "access-key-id",
			AccessKeySecret: "access-key-secret",
		},
	})
	if err == nil || !strings.Contains(err.Error(), "does not match") {
		t.Fatalf("NewFileStorage() error = %v", err)
	}
}
