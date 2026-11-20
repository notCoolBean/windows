//go:build cgo

package types

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/yanyiwu/gojieba"
)

// Jieba is a global instance of Chinese text segmentation tool.
var Jieba = newJieba()

func newJieba() *gojieba.Jieba {
	dictDir := os.Getenv("JIEBA_DICT_DIR")
	// A desktop distribution must not use the build machine's module cache.
	if dictDir == "" {
		if executable, err := os.Executable(); err == nil {
			root := filepath.Dir(executable)
			if strings.Contains(executable, ".app/Contents/MacOS/") {
				root = filepath.Join(filepath.Dir(root), "Resources")
			}
			candidate := filepath.Join(root, "dict")
			if _, err := os.Stat(filepath.Join(candidate, "jieba.dict.utf8")); err == nil {
				dictDir = candidate
			}
		}
	}
	if dictDir == "" {
		return gojieba.NewJieba()
	}

	return gojieba.NewJieba(
		filepath.Join(dictDir, "jieba.dict.utf8"),
		filepath.Join(dictDir, "hmm_model.utf8"),
		filepath.Join(dictDir, "user.dict.utf8"),
		filepath.Join(dictDir, "idf.utf8"),
		filepath.Join(dictDir, "stop_words.utf8"),
	)
}
