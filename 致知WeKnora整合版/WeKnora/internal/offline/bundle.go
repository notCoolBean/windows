package offline

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

type BundledModel struct {
	Kind             string `json:"kind"`
	File             string `json:"file"`
	SHA256           string `json:"sha256"`
	Projection       string `json:"projection,omitempty"`
	ProjectionSHA256 string `json:"projection_sha256,omitempty"`
}

// InstallBundle is restartable: imported models retain their identities and a
// user's chosen primary model. The package never writes an existing catalog.
func (m *Manager) InstallBundle(ctx context.Context, dir string) (Catalog, error) {
	raw, err := os.ReadFile(filepath.Join(dir, "manifest.json"))
	if os.IsNotExist(err) {
		return m.Catalog(), nil
	}
	if err != nil {
		return Catalog{}, err
	}
	var entries []BundledModel
	if err = json.Unmarshal(raw, &entries); err != nil {
		return Catalog{}, fmt.Errorf("随包模型清单损坏: %w", err)
	}
	verified := map[string]bool{}
	for _, entry := range entries {
		if entry.Kind != "KnowledgeQA" && entry.Kind != "Embedding" && entry.Kind != "VLLM" {
			return Catalog{}, fmt.Errorf("随包模型用途无效")
		}
		if err = validateBundleName(entry.File, entry.SHA256); err != nil {
			return Catalog{}, err
		}
		id := entry.Kind + "-" + entry.SHA256
		if entry.Kind == "VLLM" {
			if err = validateBundleName(entry.Projection, entry.ProjectionSHA256); err != nil {
				return Catalog{}, err
			}
			id += "-" + entry.ProjectionSHA256
		}
		installed := false
		for _, model := range m.Catalog().Models {
			if model.ID == id {
				installed = true
				break
			}
		}
		if installed {
			continue
		}
		files := map[string]string{entry.File: entry.SHA256}
		if entry.Kind == "VLLM" {
			files[entry.Projection] = entry.ProjectionSHA256
		}
		for name, digest := range files {
			if verified[name+digest] {
				continue
			}
			if err = verifyBundleFile(ctx, filepath.Join(dir, name), digest); err != nil {
				return Catalog{}, err
			}
			verified[name+digest] = true
		}
		projection := ""
		if entry.Kind == "VLLM" {
			projection = filepath.Join(dir, entry.Projection)
		}
		if _, err = m.Import(ctx, filepath.Join(dir, entry.File), entry.Kind, projection); err != nil {
			return Catalog{}, fmt.Errorf("初始化 %s 失败: %w", entry.File, err)
		}
	}
	return m.Catalog(), nil
}

func validateBundleName(name, digest string) error {
	decoded, err := hex.DecodeString(digest)
	if name == "" || name == "." || name == ".." || strings.ContainsAny(name, `/\:`) || err != nil || len(decoded) != sha256.Size || digest != strings.ToLower(digest) {
		return fmt.Errorf("随包模型文件名或校验值无效")
	}
	return nil
}

func verifyBundleFile(ctx context.Context, path, expected string) error {
	f, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("随包模型缺失: %w", err)
	}
	defer f.Close()
	hash := sha256.New()
	buffer := make([]byte, 1024*1024)
	for {
		if err = ctx.Err(); err != nil {
			return err
		}
		n, readErr := f.Read(buffer)
		if n > 0 {
			hash.Write(buffer[:n])
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return readErr
		}
	}
	if hex.EncodeToString(hash.Sum(nil)) != expected {
		return fmt.Errorf("模型校验失败，请重新复制完整安装包: %s", filepath.Base(path))
	}
	return nil
}
