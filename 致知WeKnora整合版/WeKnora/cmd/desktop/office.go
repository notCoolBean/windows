package main

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

type officeProcess struct {
	target *url.URL
	input  io.WriteCloser
	cmd    *exec.Cmd
}

var officeMu sync.Mutex
var officeProcesses = map[string]*officeProcess{}

func (a *App) OpenOffice(tool string) (string, error) {
	if tool != "writer" && tool != "office" && tool != "analysis" && tool != "notes" && tool != "notepad" && tool != "query" {
		return "", fmt.Errorf("未知办公功能")
	}
	officeMu.Lock()
	defer officeMu.Unlock()
	if officeProcesses[tool] != nil {
		return "/zhizhi/" + tool + "/", nil
	}
	root, err := os.Getwd()
	if err != nil {
		return "", err
	}
	python := filepath.Join(root, "python", "bin", "python3.11")
	if runtime.GOOS == "windows" {
		python = filepath.Join(root, "python", "python.exe")
	}
	catalog := offlineModels.Catalog()
	cmd := exec.Command(python, "-B", filepath.Join(root, "office", "bridge.py"), tool)
	cmd.Env = append(os.Environ(), "ZZ_MODEL_URL="+catalog.BaseURL+"/primary", "ZZ_MODEL_KEY="+catalog.Key)
	out, err := cmd.StdoutPipe()
	if err != nil {
		return "", err
	}
	input, err := cmd.StdinPipe()
	if err != nil {
		return "", err
	}
	cmd.Stderr = os.Stderr
	if err = cmd.Start(); err != nil {
		return "", fmt.Errorf("办公组件启动失败: %w", err)
	}
	ready := make(chan string, 1)
	go func() {
		scanner := bufio.NewScanner(out)
		if scanner.Scan() {
			ready <- scanner.Text()
		} else {
			ready <- ""
		}
		io.Copy(io.Discard, out)
	}()
	var address string
	select {
	case address = <-ready:
	case <-time.After(20 * time.Second):
	}
	target, err := url.Parse(address)
	if err != nil || target.Hostname() != "127.0.0.1" || target.Scheme != "http" {
		input.Close()
		cmd.Process.Kill()
		cmd.Wait()
		return "", fmt.Errorf("办公组件未能就绪")
	}
	officeProcesses[tool] = &officeProcess{target: target, input: input, cmd: cmd}
	return "/zhizhi/" + tool + "/", nil
}

func closeOffice() {
	officeMu.Lock()
	defer officeMu.Unlock()
	for name, p := range officeProcesses {
		p.input.Close()
		p.cmd.Process.Kill()
		p.cmd.Wait()
		delete(officeProcesses, name)
	}
}

func withOffice(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/zhizhi/") {
			next.ServeHTTP(w, r)
			return
		}
		parts := strings.SplitN(strings.TrimPrefix(r.URL.Path, "/zhizhi/"), "/", 2)
		if len(parts) != 2 {
			http.NotFound(w, r)
			return
		}
		officeMu.Lock()
		p := officeProcesses[parts[0]]
		officeMu.Unlock()
		if p == nil {
			http.Error(w, "请从致知办公页面打开此功能", 503)
			return
		}
		// WebView requests may have unknown length. The Python office handlers
		// read Content-Length and cannot decode chunked request bodies.
		if r.Method == http.MethodPost && parts[1] == "api" {
			body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 24<<20))
			if err != nil {
				http.Error(w, "无法读取提交内容或内容超过 24 MB", http.StatusRequestEntityTooLarge)
				return
			}
			r.Body.Close()
			r.Body = io.NopCloser(bytes.NewReader(body))
			r.ContentLength = int64(len(body))
			r.TransferEncoding = nil
		}
		proxy := httputil.NewSingleHostReverseProxy(p.target)
		original := proxy.Director
		proxy.Director = func(req *http.Request) {
			original(req)
			req.Host = p.target.Host
			req.Header.Set("Origin", p.target.String())
		}
		proxy.FlushInterval = -1
		r.URL.Path = "/" + parts[1]
		proxy.ServeHTTP(w, r)
	})
}
