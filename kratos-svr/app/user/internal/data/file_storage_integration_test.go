package data

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"kratos-svr/app/user/internal/conf"

	"github.com/go-kratos/kratos/v3/config"
	"github.com/go-kratos/kratos/v3/config/file"
)

func TestAliyunOSSConfiguredUpload(t *testing.T) {
	configPath := strings.TrimSpace(os.Getenv("GEO_USER_CONFIG_PATH"))
	if configPath == "" {
		t.Skip("set GEO_USER_CONFIG_PATH to run the Aliyun OSS integration test")
	}

	source := config.New(config.WithSource(file.NewSource(configPath)))
	if err := source.Load(); err != nil {
		t.Fatalf("load user config: %v", err)
	}
	defer source.Close()

	var bootstrap conf.Bootstrap
	if err := source.Scan(&bootstrap); err != nil {
		t.Fatalf("scan user config: %v", err)
	}
	if bootstrap.GetStorage().GetDriver() != fileStorageDriverAliyunOSS {
		t.Fatalf("storage driver = %q, want %q", bootstrap.GetStorage().GetDriver(), fileStorageDriverAliyunOSS)
	}

	storage, err := NewFileStorage(bootstrap.GetStorage())
	if err != nil {
		t.Fatalf("create configured storage: %v", err)
	}
	content, err := base64.StdEncoding.DecodeString("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")
	if err != nil {
		t.Fatal(err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	logicalKey := fmt.Sprintf("integration-tests/codex-upload-%d.png", time.Now().UnixNano())
	key, err := storage.Put(ctx, logicalKey, "image/png", content)
	if err != nil {
		t.Fatalf("upload configured Aliyun OSS image: %v", err)
	}
	defer func() {
		deleteCtx, deleteCancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer deleteCancel()
		if err := storage.Delete(deleteCtx, key); err != nil {
			t.Errorf("delete integration test object: %v", err)
		}
	}()

	response, err := (&http.Client{Timeout: 15 * time.Second}).Get(storage.PublicURL(key))
	if err != nil {
		t.Fatalf("read uploaded image from public URL: %v", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		t.Fatalf("public image URL returned HTTP %d", response.StatusCode)
	}
}
