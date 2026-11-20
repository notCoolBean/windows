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
