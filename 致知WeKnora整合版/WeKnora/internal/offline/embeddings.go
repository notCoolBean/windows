package offline

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// WeKnora's generic embedding provider sends vLLM's truncation parameter.
// llama.cpp ignores it; apply that explicit budget using the model's own
// tokenizer, retaining its BOS/EOS tokens. Stored source text is unaffected.
func (m *Manager) prepareEmbeddings(r *http.Request) error {
	body, err := io.ReadAll(io.LimitReader(r.Body, 16<<20+1))
	r.Body.Close()
	if err != nil {
		return err
	}
	if len(body) > 16<<20 {
		return fmt.Errorf("向量请求过大，请减小分批数量")
	}
	var payload map[string]json.RawMessage
	if err = json.Unmarshal(body, &payload); err != nil {
		return err
	}
	var budget int
	_ = json.Unmarshal(payload["truncate_prompt_tokens"], &budget)
	if budget > 0 {
		var inputs []string
		if json.Unmarshal(payload["input"], &inputs) != nil {
			var single string
			if json.Unmarshal(payload["input"], &single) == nil {
				inputs = []string{single}
			}
		}
		if len(inputs) > 0 {
			tokenInputs := make([][]int, len(inputs))
			for i, input := range inputs {
				full, err := m.tokenize(r.Context(), input, true)
				if err != nil {
					return err
				}
				if len(full) > budget {
					plain, err := m.tokenize(r.Context(), input, false)
					if err != nil {
						return err
					}
					full, err = truncateWithSpecialTokens(full, plain, budget)
					if err != nil {
						return err
					}
				}
				tokenInputs[i] = full
			}
			payload["input"], err = json.Marshal(tokenInputs)
			if err != nil {
				return err
			}
			delete(payload, "truncate_prompt_tokens")
			body, err = json.Marshal(payload)
			if err != nil {
				return err
			}
		}
	}
	r.Body = io.NopCloser(bytes.NewReader(body))
	r.ContentLength = int64(len(body))
	return nil
}

func (m *Manager) tokenize(ctx context.Context, text string, special bool) ([]int, error) {
	payload, _ := json.Marshal(map[string]any{"content": text, "add_special": special, "parse_special": false})
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, m.upstream+"/tokenize", bytes.NewReader(payload))
	req.Header.Set("Authorization", "Bearer "+m.key)
	req.Header.Set("Content-Type", "application/json")
	response, err := localClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("向量模型分词失败: HTTP %d", response.StatusCode)
	}
	var result struct {
		Tokens []int `json:"tokens"`
	}
	err = json.NewDecoder(io.LimitReader(response.Body, 32<<20)).Decode(&result)
	return result.Tokens, err
}

func truncateWithSpecialTokens(full, plain []int, budget int) ([]int, error) {
	extra := len(full) - len(plain)
	if extra < 0 || budget <= extra {
		return nil, fmt.Errorf("向量截断长度不足")
	}
	for prefix := 0; prefix <= extra; prefix++ {
		matches := true
		for i, token := range plain {
			if full[prefix+i] != token {
				matches = false
				break
			}
		}
		if !matches {
			continue
		}
		result := append([]int{}, full[:prefix]...)
		result = append(result, plain[:min(len(plain), budget-extra)]...)
		result = append(result, full[prefix+len(plain):]...)
		return result, nil
	}
	return nil, fmt.Errorf("无法识别向量模型的特殊标记，请缩短知识库分段")
}
