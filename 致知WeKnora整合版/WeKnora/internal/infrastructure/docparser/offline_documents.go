package docparser

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"time"

	"github.com/Tencent/WeKnora/internal/types"
)

func offlineDocumentFormat(kind string) bool {
	if os.Getenv("ZZ_DOCUMENT_PYTHON") == "" {
		return false
	}
	return kind == "docx" || kind == "xlsx" || kind == "pptx" || kind == "pdf"
}

func readOfflineDocument(ctx context.Context, req *types.ReadRequest, kind string) (*types.ReadResult, error) {
	ctx, cancel := context.WithTimeout(ctx, 90*time.Second)
	defer cancel()
	command := exec.CommandContext(ctx, os.Getenv("ZZ_DOCUMENT_PYTHON"), "-B", os.Getenv("ZZ_DOCUMENT_SCRIPT"), kind)
	command.Stdin = bytes.NewReader(req.FileContent)
	var stderr bytes.Buffer
	command.Stderr = &stderr
	output, err := command.Output()
	if err != nil {
		return nil, fmt.Errorf("本地文档解析失败: %s (%v)", stderr.String(), err)
	}
	var result struct {
		Text string `json:"text"`
	}
	if err = json.Unmarshal(output, &result); err != nil {
		return nil, err
	}
	return &types.ReadResult{MarkdownContent: result.Text, Metadata: map[string]string{"parser": "zhizhi-offline-text", "source_format": kind}}, nil
}
