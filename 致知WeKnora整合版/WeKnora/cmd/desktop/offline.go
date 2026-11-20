package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"time"

	"github.com/Tencent/WeKnora/internal/offline"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

var offlineModels *offline.Manager

// Each packaged platform uses its own bundled engine and writable user data.
func configureOffline(root string) error {
	dir, err := os.UserConfigDir()
	if err != nil {
		return err
	}
	dir = filepath.Join(dir, "致知知识工作台")
	if err = os.MkdirAll(dir, 0700); err != nil {
		return err
	}
	engine := filepath.Join(root, "runtime", "llama-server")
	python := filepath.Join(root, "python", "bin", "python3.11")
	if runtime.GOOS == "windows" {
		engine += ".exe"
		python = filepath.Join(root, "python", "python.exe")
	}
	for key, value := range map[string]string{
		"ZZ_DOCUMENT_PYTHON": python, "ZZ_DOCUMENT_SCRIPT": filepath.Join(root, "office", "parse_document.py"),
		"DB_DRIVER": "sqlite", "DB_PATH": filepath.Join(dir, "knowledge.sqlite3"),
		"RETRIEVE_DRIVER": "sqlite", "STORAGE_TYPE": "local",
		"LOCAL_STORAGE_BASE_DIR": filepath.Join(dir, "files"), "STREAM_MANAGER_TYPE": "memory",
		"DUCKDB_SKIP_EXTENSION_LOAD": "1", "SSRF_WHITELIST": "127.0.0.1,localhost",
		"NEO4J_ENABLE": "false", "ENABLE_GRAPH_RAG": "false", "WEKNORA_SANDBOX_MODE": "disabled",
		"WEKNORA_SANDBOX_DOCKER_ENABLED": "false", "LOG_PATH": filepath.Join(dir, "app.log"),
		"WEKNORA_LANGUAGE": "zh-CN", "GIN_MODE": "release",
	} {
		if err = os.Setenv(key, value); err != nil {
			return err
		}
	}
	offlineModels, err = offline.New(filepath.Join(dir, "models"), engine)
	return err
}

func (a *App) GetOfflineModels() (offline.Catalog, error) {
	if offlineModels == nil {
		return offline.Catalog{}, fmt.Errorf("离线引擎尚未初始化")
	}
	return offlineModels.Catalog(), nil
}

func (a *App) InstallBundledModels() (offline.Catalog, error) {
	if offlineModels == nil {
		return offline.Catalog{}, fmt.Errorf("离线引擎尚未初始化")
	}
	root, err := os.Getwd()
	if err != nil {
		return offline.Catalog{}, err
	}
	ctx, cancel := context.WithTimeout(a.ctx, 15*time.Minute)
	defer cancel()
	return offlineModels.InstallBundle(ctx, filepath.Join(root, "bundled-models"))
}

func (a *App) ImportOfflineModel(kind string) (offline.Catalog, error) {
	if offlineModels == nil {
		return offline.Catalog{}, fmt.Errorf("离线引擎尚未初始化")
	}
	path, err := wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title: "选择离线 GGUF 模型", Filters: []wailsruntime.FileFilter{{DisplayName: "GGUF 模型", Pattern: "*.gguf"}},
	})
	if err != nil || path == "" {
		return offlineModels.Catalog(), err
	}
	projection := ""
	if kind == "VLLM" {
		projection, err = wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{
			Title: "选择配套视觉投影 mmproj GGUF", Filters: []wailsruntime.FileFilter{{DisplayName: "GGUF 视觉组件", Pattern: "*.gguf"}},
		})
		if err != nil || projection == "" {
			return offlineModels.Catalog(), err
		}
	}
	ctx, cancel := context.WithTimeout(a.ctx, 5*time.Minute)
	defer cancel()
	if _, err = offlineModels.Import(ctx, path, kind, projection); err != nil {
		return offline.Catalog{}, err
	}
	return offlineModels.Catalog(), nil
}

func (a *App) SetOfflinePrimary(id string) error {
	if offlineModels == nil {
		return fmt.Errorf("离线引擎尚未初始化")
	}
	return offlineModels.SetPrimary(id)
}
