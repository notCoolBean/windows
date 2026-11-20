//go:build linux

package linux

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"

	wailsruntime "github.com/wailsapp/wails/v2/internal/frontend/runtime"
	"github.com/wailsapp/wails/v2/internal/logger"
	"github.com/wailsapp/wails/v2/pkg/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options"
)

func TestZhizhiLoopbackPreservesPostAndRejectsForeignOrigins(t *testing.T) {
	t.Setenv("ZZ_WAILS_LOCAL_HTTP", "1")
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	assets, err := assetserver.NewAssetServerWithHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Session", r.Header.Get("X-Session"))
		_, _ = io.Copy(w, r.Body)
	}), "{}", false, logger.New(nil), wailsruntime.RuntimeAssetsBundle)
	if err != nil {
		t.Fatal(err)
	}
	f := &Frontend{ctx: ctx, frontendOptions: &options.App{}, assets: assets}
	f.startZhizhiLoopback()
	client := &http.Client{Transport: &http.Transport{Proxy: nil}}
	defer client.CloseIdleConnections()
	for _, foreign := range []bool{false, true} {
		body := `{"action":"generate","sample":"范文正文"}`
		req, err := http.NewRequest(http.MethodPost, f.startURL.String()+"zhizhi/writer/api", strings.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("X-Session", "test-session")
		req.Header.Set("Origin", "http://"+f.startURL.Host)
		if foreign {
			req.Header.Set("Origin", "https://untrusted.example")
		}
		response, err := client.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		got, err := io.ReadAll(response.Body)
		response.Body.Close()
		if err != nil {
			t.Fatal(err)
		}
		if foreign {
			if response.StatusCode != http.StatusForbidden {
				t.Fatalf("foreign origin accepted: %d", response.StatusCode)
			}
		} else if response.StatusCode != http.StatusOK || string(got) != body || response.Header.Get("X-Session") != "test-session" {
			t.Fatalf("POST body or session header lost: %d %s", response.StatusCode, got)
		}
	}
}
