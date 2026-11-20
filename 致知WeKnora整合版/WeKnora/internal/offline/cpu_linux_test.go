package offline

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLinuxEngineForcesCPUDespiteInheritedGPUOptions(t *testing.T) {
	t.Setenv("LLAMA_ARG_N_GPU_LAYERS", "99")
	dir := t.TempDir()
	engine := filepath.Join(dir, "engine")
	script := "#!/bin/sh\nprintf '%s\\n' \"$@\"\nprintf 'override=%s\\n' \"${LLAMA_ARG_N_GPU_LAYERS-unset}\"\nexit 1\n"
	if err := os.WriteFile(engine, []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
	m, err := New(dir, engine)
	if err != nil {
		t.Fatal(err)
	}
	defer m.Close()
	if err := m.start(context.Background(), Model{ID: "KnowledgeQA-" + strings.Repeat("a", 64)}); err == nil {
		t.Fatal("exited engine reported ready")
	}
	log, err := os.ReadFile(filepath.Join(dir, "engine.log"))
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"\n-ngl\n0\n", "\n--no-mmproj-offload\n", "\noverride=unset\n"} {
		if !strings.Contains(string(log), want) {
			t.Errorf("missing CPU isolation setting %q", want)
		}
	}
}

func TestLinuxLowMemoryProfile(t *testing.T) {
	t.Setenv("ZZ_OFFLINE_LOW_MEMORY", "1")
	for _, kind := range []string{"KnowledgeQA", "Embedding", "VLLM"} {
		t.Run(kind, func(t *testing.T) {
			dir := t.TempDir()
			engine := filepath.Join(dir, "engine")
			if err := os.WriteFile(engine, []byte("#!/bin/sh\nprintf '%s\\n' \"$@\"\nexit 1\n"), 0700); err != nil {
				t.Fatal(err)
			}
			m, err := New(dir, engine)
			if err != nil {
				t.Fatal(err)
			}
			defer m.Close()
			m.models = []Model{{ID: kind + "-" + strings.Repeat("a", 64), Kind: kind}}
			expectedContext := 4096
			if kind == "Embedding" {
				expectedContext = 512
			}
			if got := m.Catalog().Models[0].ContextWindow; got != expectedContext {
				t.Fatalf("advertised context = %d, want %d", got, expectedContext)
			}
			digest := strings.Repeat("a", 64)
			if kind != "Embedding" {
				digest = "f18f594747e5317ab490cff9c06339c9cfb89acbe2f02ebc48a4e167bc23576d"
			}
			if err := m.start(context.Background(), Model{ID: kind + "-" + digest, Kind: kind}); err == nil {
				t.Fatal("exited engine reported ready")
			}
			log, err := os.ReadFile(filepath.Join(dir, "engine.log"))
			if err != nil {
				t.Fatal(err)
			}
			want := []string{"\n-c\n4096\n", "\n-b\n256\n", "\n-ub\n128\n"}
			if kind == "Embedding" {
				want = []string{"\n-c\n512\n", "\n-b\n512\n", "\n-ub\n512\n"}
			} else {
				want = append(want, "\n--reasoning\noff\n")
			}
			for _, setting := range append(want, "\n-t\n6\n", "\n-ngl\n0\n") {
				if !strings.Contains(string(log), setting) {
					t.Errorf("missing low-memory setting %q", setting)
				}
			}
		})
	}
}
