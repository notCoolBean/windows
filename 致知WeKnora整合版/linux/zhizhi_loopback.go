//go:build linux

// Linux compatibility adapter for Wails v2.12.0. WebKitGTK before 2.40
// cannot read POST bodies from a custom URI scheme; use real loopback HTTP.
package linux

import (
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/internal/frontend/originvalidator"
)

func (f *Frontend) startZhizhiLoopback() {
	if os.Getenv("ZZ_WAILS_LOCAL_HTTP") != "1" {
		return
	}
	config, err := os.UserConfigDir()
	if err != nil {
		panic(err)
	}
	portFile := filepath.Join(config, "致知知识工作台", "ui-port")
	port := "0"
	if saved, err := os.ReadFile(portFile); err == nil {
		port = strings.TrimSpace(string(saved))
		n, err := strconv.Atoi(port)
		if err != nil || n < 1024 || n > 65535 {
			panic("本机界面端口配置无效")
		}
	} else if !os.IsNotExist(err) {
		panic(err)
	}
	listener, err := net.Listen("tcp", "127.0.0.1:"+port)
	if err != nil {
		panic(fmt.Errorf("界面端口被占用，请先关闭已打开的致知窗口: %w", err))
	}
	if err := os.MkdirAll(filepath.Dir(portFile), 0700); err != nil {
		panic(err)
	}
	_, port, _ = net.SplitHostPort(listener.Addr().String())
	if err := os.WriteFile(portFile, []byte(port), 0600); err != nil {
		panic(err)
	}
	host := listener.Addr().String()
	origin := "http://" + host
	f.startURL, _ = url.Parse(origin + "/")
	f.originValidator = originvalidator.NewOriginValidator(f.startURL, f.frontendOptions.BindingsAllowedOrigins)
	server := &http.Server{
		ReadHeaderTimeout: 10 * time.Second,
		Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Host != host || (r.Header.Get("Origin") != "" && r.Header.Get("Origin") != origin) {
				http.Error(w, "Forbidden", http.StatusForbidden)
				return
			}
			f.assets.ServeHTTP(w, r)
		}),
	}
	go func() { _ = server.Serve(listener) }()
	go func() { <-f.ctx.Done(); _ = server.Close() }()
}
