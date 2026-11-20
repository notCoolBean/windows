package lite_smoke_test

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/Tencent/WeKnora/internal/offline"
	"github.com/stretchr/testify/require"
)

type smokeModels struct {
	chatURL, embedURL, key string
	dimensions             int
}

func startSmokeModels(t *testing.T) smokeModels {
	dir := os.Getenv("ZZ_TEST_BUNDLE")
	if dir == "" {
		server := startLoopbackOpenAIServer(t)
		return smokeModels{server.URL + "/v1", server.URL + "/v1", "sk-smoke-local", embeddingDims}
	}
	manager, err := offline.New(t.TempDir(), os.Getenv("ZZ_TEST_ENGINE"))
	require.NoError(t, err)
	t.Cleanup(manager.Close)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	catalog, err := manager.InstallBundle(ctx, dir)
	require.NoError(t, err)
	require.Len(t, catalog.Models, 3)
	again, err := manager.InstallBundle(ctx, dir)
	require.NoError(t, err)
	require.Equal(t, catalog.Models, again.Models, "repeated startup must not duplicate models")
	result := smokeModels{chatURL: catalog.BaseURL + "/primary/v1", key: catalog.Key}
	for _, model := range catalog.Models {
		if model.Kind == "Embedding" {
			result.embedURL = catalog.BaseURL + "/" + model.ID + "/v1"
			result.dimensions = model.Dimension
		}
	}
	require.Equal(t, 512, result.dimensions)
	// Exercise the mmproj path with actual pixels rather than a text-only probe.
	img := image.NewRGBA(image.Rect(0, 0, 128, 128))
	for y := 0; y < 128; y++ {
		for x := 0; x < 128; x++ {
			img.SetRGBA(x, y, color.RGBA{R: 255, A: 255})
		}
	}
	var imageBytes bytes.Buffer
	require.NoError(t, png.Encode(&imageBytes, img))
	payload, _ := json.Marshal(map[string]any{"model": "local", "max_tokens": 64, "temperature": 0, "messages": []any{map[string]any{"role": "user", "content": []any{
		map[string]any{"type": "text", "text": "图片的主要颜色是什么？只回答颜色。"},
		map[string]any{"type": "image_url", "image_url": map[string]string{"url": "data:image/png;base64," + base64.StdEncoding.EncodeToString(imageBytes.Bytes())}},
	}}}})
	req, _ := http.NewRequestWithContext(ctx, "POST", catalog.BaseURL+"/vision/v1/chat/completions", bytes.NewReader(payload))
	req.Header.Set("Authorization", "Bearer "+catalog.Key)
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Transport: &http.Transport{Proxy: nil}, Timeout: 3 * time.Minute}
	resp, err := client.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.Equal(t, 200, resp.StatusCode, string(raw))
	var answer struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	require.NoError(t, json.Unmarshal(raw, &answer))
	require.NotEmpty(t, answer.Choices)
	require.Contains(t, answer.Choices[0].Message.Content, "红")
	t.Logf("Real vision answer: %s; embedding dimensions: %d", answer.Choices[0].Message.Content, result.dimensions)
	if script := os.Getenv("ZZ_TEST_OFFICE_SCRIPT"); script != "" {
		command := exec.CommandContext(ctx, "python3", "-m", "unittest", "-v", "test_office.OfficeBridgeTest.test_actual_models")
		command.Dir = filepath.Dir(script)
		command.Env = append(os.Environ(), "ZZ_TEST_MODEL_URL="+catalog.BaseURL+"/primary", "ZZ_TEST_MODEL_KEY="+catalog.Key)
		output, err := command.CombinedOutput()
		require.NoError(t, err, string(output))
		t.Logf("Real office inference: %s", output)
	}
	return result
}
