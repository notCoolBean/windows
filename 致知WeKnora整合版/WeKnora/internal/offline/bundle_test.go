package offline

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestBundleRejectsCorruptionBeforeImport(t *testing.T) {
	m, err := New(t.TempDir(), "missing-engine")
	if err != nil {
		t.Fatal(err)
	}
	defer m.Close()
	dir := t.TempDir()
	manifest, _ := json.Marshal([]BundledModel{{Kind: "KnowledgeQA", File: "model.gguf", SHA256: strings.Repeat("a", 64)}})
	os.WriteFile(filepath.Join(dir, "manifest.json"), manifest, 0600)
	os.WriteFile(filepath.Join(dir, "model.gguf"), []byte("corrupted"), 0600)
	if _, err = m.InstallBundle(context.Background(), dir); err == nil || !strings.Contains(err.Error(), "校验失败") {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(m.Catalog().Models) != 0 {
		t.Fatal("registered corrupt model")
	}
}

func TestBundleExistingModelsDoNotReimportOrChangePrimary(t *testing.T) {
	m, err := New(t.TempDir(), "missing-engine")
	if err != nil {
		t.Fatal(err)
	}
	defer m.Close()
	digest := strings.Repeat("a", 64)
	id := "KnowledgeQA-" + digest
	m.models = []Model{{ID: id, Kind: "KnowledgeQA"}}
	m.primary = "user-selected-model"
	dir := t.TempDir()
	manifest, _ := json.Marshal([]BundledModel{{Kind: "KnowledgeQA", File: "model.gguf", SHA256: digest}})
	os.WriteFile(filepath.Join(dir, "manifest.json"), manifest, 0600)
	for i := 0; i < 2; i++ {
		catalog, err := m.InstallBundle(context.Background(), dir)
		if err != nil || len(catalog.Models) != 1 || catalog.Primary != "user-selected-model" {
			t.Fatalf("catalog changed: %+v %v", catalog, err)
		}
	}
}

func TestBundleFileValidationAndCancellation(t *testing.T) {
	for _, name := range []string{"../model.gguf", `..\model.gguf`, "/tmp/model.gguf", "C:model.gguf", ""} {
		if validateBundleName(name, strings.Repeat("a", 64)) == nil {
			t.Fatalf("accepted %q", name)
		}
	}
	path := filepath.Join(t.TempDir(), "model.gguf")
	content := []byte("test content")
	os.WriteFile(path, content, 0600)
	digest := sha256.Sum256(content)
	if err := verifyBundleFile(context.Background(), path, hex.EncodeToString(digest[:])); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := verifyBundleFile(ctx, path, hex.EncodeToString(digest[:])); err != context.Canceled {
		t.Fatalf("cancellation lost: %v", err)
	}
}
