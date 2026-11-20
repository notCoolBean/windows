package offline

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestCopyGGUFRejectsInvalidAndDeduplicates(t *testing.T) {
	dir := t.TempDir()
	source := filepath.Join(t.TempDir(), "模型.gguf")
	if err := os.WriteFile(source, []byte("not a model"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, _, err := copyGGUF(source, dir); err == nil {
		t.Fatal("accepted invalid model")
	}
	if err := os.WriteFile(source, append([]byte{'G', 'G', 'U', 'F', 3, 0, 0, 0}, make([]byte, 32)...), 0600); err != nil {
		t.Fatal(err)
	}
	first, size, err := copyGGUF(source, dir)
	if err != nil {
		t.Fatal(err)
	}
	second, _, err := copyGGUF(source, dir)
	if err != nil || first != second || size != 40 {
		t.Fatalf("dedup: %s %s %d %v", first, second, size, err)
	}
	files, _ := os.ReadDir(dir)
	if len(files) != 1 {
		t.Fatalf("left temporary files: %v", files)
	}
}

func TestGatewayRequiresCapabilityAndDoesNotFallBackToNetwork(t *testing.T) {
	m, err := New(t.TempDir(), "missing-engine")
	if err != nil {
		t.Fatal(err)
	}
	defer m.Close()
	for _, test := range []struct {
		key  string
		want int
	}{{"", 401}, {m.key, 503}} {
		req := httptest.NewRequest("POST", "/primary/v1/chat/completions", nil)
		if test.key != "" {
			req.Header.Set("Authorization", "Bearer "+test.key)
		}
		w := httptest.NewRecorder()
		m.ServeHTTP(w, req)
		if w.Code != test.want {
			t.Fatalf("status %d want %d", w.Code, test.want)
		}
	}
}

func TestFailedImportPreservesCatalogAndRemovesUncommittedCopy(t *testing.T) {
	dir := t.TempDir()
	m, err := New(dir, "missing-engine")
	if err != nil {
		t.Fatal(err)
	}
	defer m.Close()
	source := filepath.Join(t.TempDir(), "model.gguf")
	os.WriteFile(source, append([]byte{'G', 'G', 'U', 'F', 3, 0, 0, 0}, make([]byte, 32)...), 0600)
	if _, err = m.Import(context.Background(), source, "KnowledgeQA", ""); err == nil {
		t.Fatal("import succeeded without engine")
	}
	if len(m.Catalog().Models) != 0 {
		t.Fatal("failed model was registered")
	}
	files, _ := filepath.Glob(filepath.Join(dir, "*.gguf"))
	if len(files) != 0 {
		t.Fatal("failed import leaked weights")
	}
}

func TestPrimaryPersistsButSessionCredentialsRotate(t *testing.T) {
	dir := t.TempDir()
	m, err := New(dir, "missing-engine")
	if err != nil {
		t.Fatal(err)
	}
	id := "KnowledgeQA-" + strings.Repeat("a", 64)
	m.models = []Model{{ID: id, Kind: "KnowledgeQA"}}
	if err = m.SetPrimary(id); err != nil {
		t.Fatal(err)
	}
	old := m.Catalog()
	m.Close()
	next, err := New(dir, "missing-engine")
	if err != nil {
		t.Fatal(err)
	}
	defer next.Close()
	catalog := next.Catalog()
	if catalog.Primary != id || catalog.Key == old.Key {
		t.Fatal("persistence or rotation failed")
	}
	raw, _ := os.ReadFile(filepath.Join(dir, "models.json"))
	if strings.Contains(string(raw), old.Key) {
		t.Fatal("ephemeral key persisted")
	}
}

// Opt-in smoke test against supplied weights; these are never included in packages.
func TestActualOfflineModel(t *testing.T) {
	engine, path := os.Getenv("ZZ_TEST_ENGINE"), os.Getenv("ZZ_TEST_MODEL")
	if engine == "" || path == "" {
		t.Skip("set ZZ_TEST_ENGINE and ZZ_TEST_MODEL for real inference")
	}
	m, err := New(t.TempDir(), engine)
	if err != nil {
		t.Fatal(err)
	}
	defer m.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	kind := os.Getenv("ZZ_TEST_KIND")
	if kind == "" {
		kind = "KnowledgeQA"
	}
	model, err := m.Import(ctx, path, kind, os.Getenv("ZZ_TEST_PROJECTION"))
	if err != nil {
		t.Fatal(err)
	}
	if kind == "Embedding" && model.Dimension == 0 {
		t.Fatal("missing embedding dimension")
	}
	if kind == "Embedding" {
		payload, _ := json.Marshal(map[string]any{"model": "local", "input": []string{"短文", strings.Repeat("离线模型知识库应用性能验证。", 80)}, "truncate_prompt_tokens": 511, "encoding_format": "float"})
		request, _ := http.NewRequestWithContext(ctx, "POST", m.base+"/"+model.ID+"/v1/embeddings", strings.NewReader(string(payload)))
		request.Header.Set("Authorization", "Bearer "+m.key)
		request.Header.Set("Content-Type", "application/json")
		response, err := localClient.Do(request)
		if err != nil {
			t.Fatal(err)
		}
		defer response.Body.Close()
		var result struct {
			Data []struct {
				Embedding []float64 `json:"embedding"`
			} `json:"data"`
		}
		if response.StatusCode != 200 || json.NewDecoder(response.Body).Decode(&result) != nil || len(result.Data) != 2 {
			t.Fatalf("long embedding failed: HTTP %d", response.StatusCode)
		}
		for _, item := range result.Data {
			if len(item.Embedding) != model.Dimension {
				t.Fatal("embedding dimension changed")
			}
		}
	}
	req, _ := http.NewRequestWithContext(ctx, "GET", m.base+"/"+model.ID+"/v1/models", nil)
	req.Header.Set("Authorization", "Bearer "+m.key)
	response, err := localClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	var result map[string]any
	if response.StatusCode != 200 || json.NewDecoder(response.Body).Decode(&result) != nil {
		t.Fatal("model gateway did not return metadata")
	}
}
