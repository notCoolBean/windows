// Package offline owns user-imported GGUF files and the bundled inference process.
package offline

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

type Model struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Kind       string `json:"kind"`
	Size       int64  `json:"size"`
	Dimension  int    `json:"dimension"`
	Projection string `json:"projection,omitempty"`
}

type Catalog struct {
	Models  []Model `json:"models"`
	Primary string  `json:"primary"`
	BaseURL string  `json:"base_url"`
	Key     string  `json:"key"`
}

type Manager struct {
	mu                     sync.Mutex
	dir, engine, base, key string
	models                 []Model
	primary                string
	server                 *http.Server
	process                *exec.Cmd
	done                   chan error
	loaded, upstream       string
	log                    *os.File
	closed                 bool
}

func New(dir, engine string) (*Manager, error) {
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, err
	}
	m := &Manager{dir: dir, engine: engine, models: []Model{}}
	data, err := os.ReadFile(filepath.Join(dir, "models.json"))
	if err == nil {
		var c Catalog
		if err = json.Unmarshal(data, &c); err != nil {
			return nil, fmt.Errorf("模型目录损坏: %w", err)
		}
		m.models, m.primary = c.Models, c.Primary
	} else if !os.IsNotExist(err) {
		return nil, err
	}
	key := make([]byte, 32)
	if _, err = rand.Read(key); err != nil {
		return nil, err
	}
	m.key = hex.EncodeToString(key)
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, err
	}
	m.base = "http://" + listener.Addr().String()
	m.server = &http.Server{Handler: m, ReadHeaderTimeout: 10 * time.Second}
	go m.server.Serve(listener)
	return m, nil
}

func (m *Manager) Catalog() Catalog {
	m.mu.Lock()
	defer m.mu.Unlock()
	return Catalog{Models: append([]Model{}, m.models...), Primary: m.primary, BaseURL: m.base, Key: m.key}
}

func (m *Manager) save() error {
	data, err := json.MarshalIndent(Catalog{Models: m.models, Primary: m.primary}, "", "  ")
	if err != nil {
		return err
	}
	temp, err := os.CreateTemp(m.dir, "catalog-*.tmp")
	if err != nil {
		return err
	}
	defer os.Remove(temp.Name())
	if _, err = temp.Write(data); err != nil {
		temp.Close()
		return err
	}
	if err = temp.Close(); err != nil {
		return err
	}
	return os.Rename(temp.Name(), filepath.Join(m.dir, "models.json"))
}

// Import copies into managed storage before validating with the actual engine.
// A failed probe never replaces an existing catalog or knowledge-base binding.
func (m *Manager) Import(ctx context.Context, path, kind, projection string) (Model, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.closed {
		return Model{}, fmt.Errorf("应用正在退出")
	}
	if kind != "KnowledgeQA" && kind != "Embedding" && kind != "VLLM" {
		return Model{}, fmt.Errorf("未知模型用途")
	}
	digest, size, err := copyGGUF(path, m.dir)
	if err != nil {
		return Model{}, err
	}
	model := Model{ID: kind + "-" + digest, Name: filepath.Base(path), Kind: kind, Size: size}
	defer func() {
		for _, candidate := range []string{digest, model.Projection} {
			if candidate == "" {
				continue
			}
			used := false
			for _, saved := range m.models {
				if strings.Contains(saved.ID, candidate) {
					used = true
					break
				}
			}
			if !used {
				m.stop()
				_ = os.Remove(filepath.Join(m.dir, candidate+".gguf"))
			}
		}
	}()
	if kind == "VLLM" {
		if projection == "" {
			return Model{}, fmt.Errorf("视觉模型需要配套的 mmproj GGUF 文件")
		}
		model.Projection, _, err = copyGGUF(projection, m.dir)
		if err != nil {
			return Model{}, err
		}
		model.ID += "-" + model.Projection
	}
	for _, existing := range m.models {
		if existing.ID == model.ID {
			return existing, nil
		}
	}
	if err = m.start(ctx, model); err != nil {
		return Model{}, err
	}
	if kind != "Embedding" {
		payload := []byte(`{"model":"local","messages":[{"role":"user","content":"你好"}],"max_tokens":1}`)
		req, _ := http.NewRequestWithContext(ctx, "POST", m.upstream+"/v1/chat/completions", bytes.NewReader(payload))
		req.Header.Set("Authorization", "Bearer "+m.key)
		req.Header.Set("Content-Type", "application/json")
		res, err := localClient.Do(req)
		if err != nil {
			return Model{}, err
		}
		defer res.Body.Close()
		var output struct {
			Choices []json.RawMessage `json:"choices"`
		}
		if res.StatusCode != 200 {
			return Model{}, fmt.Errorf("模型无法生成文字（HTTP %d）", res.StatusCode)
		}
		if err = json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(&output); err != nil || len(output.Choices) == 0 {
			return Model{}, fmt.Errorf("模型没有返回有效生成结果")
		}
	}
	if kind == "Embedding" {
		payload := []byte(`{"model":"local","input":["离线知识库连接检查"],"encoding_format":"float"}`)
		req, _ := http.NewRequestWithContext(ctx, "POST", m.upstream+"/v1/embeddings", bytes.NewReader(payload))
		req.Header.Set("Authorization", "Bearer "+m.key)
		req.Header.Set("Content-Type", "application/json")
		res, err := localClient.Do(req)
		if err != nil {
			return Model{}, err
		}
		defer res.Body.Close()
		var out struct {
			Data []struct {
				Embedding []float64 `json:"embedding"`
			} `json:"data"`
		}
		if res.StatusCode != 200 {
			return Model{}, fmt.Errorf("向量验证失败（HTTP %d），请选择向量 GGUF 模型", res.StatusCode)
		}
		if err = json.NewDecoder(io.LimitReader(res.Body, 8<<20)).Decode(&out); err != nil {
			return Model{}, err
		}
		if len(out.Data) != 1 || len(out.Data[0].Embedding) == 0 {
			return Model{}, fmt.Errorf("模型没有返回有效向量")
		}
		model.Dimension = len(out.Data[0].Embedding)
	}
	oldPrimary := m.primary
	m.models = append(m.models, model)
	if m.primary == "" && kind == "KnowledgeQA" {
		m.primary = model.ID
	}
	if err = m.save(); err != nil {
		m.models = m.models[:len(m.models)-1]
		m.primary = oldPrimary
		return Model{}, err
	}
	return model, nil
}

func copyGGUF(path, dir string) (string, int64, error) {
	source, err := os.Open(path)
	if err != nil {
		return "", 0, err
	}
	defer source.Close()
	stat, err := source.Stat()
	if err != nil || !stat.Mode().IsRegular() {
		return "", 0, fmt.Errorf("请选择普通 GGUF 文件")
	}
	header := make([]byte, 8)
	if _, err = io.ReadFull(source, header); err != nil || string(header[:4]) != "GGUF" || (header[4] != 2 && header[4] != 3) || header[5] != 0 || header[6] != 0 || header[7] != 0 {
		return "", 0, fmt.Errorf("文件不是支持的 GGUF v2/v3 模型")
	}
	if _, err = source.Seek(0, io.SeekStart); err != nil {
		return "", 0, err
	}
	temp, err := os.CreateTemp(dir, "import-*.tmp")
	if err != nil {
		return "", 0, err
	}
	defer os.Remove(temp.Name())
	hash := sha256.New()
	size, err := io.Copy(io.MultiWriter(temp, hash), source)
	closeErr := temp.Close()
	if err != nil {
		return "", 0, err
	}
	if closeErr != nil {
		return "", 0, closeErr
	}
	digest := hex.EncodeToString(hash.Sum(nil))
	target := filepath.Join(dir, digest+".gguf")
	if _, err = os.Stat(target); os.IsNotExist(err) {
		err = os.Rename(temp.Name(), target)
	}
	if err != nil {
		return "", 0, err
	}
	return digest, size, nil
}

var localClient = &http.Client{Transport: &http.Transport{Proxy: nil}, Timeout: 5 * time.Minute}

func (m *Manager) start(ctx context.Context, model Model) error {
	if m.loaded == model.ID && m.process != nil {
		select {
		case <-m.done:
			m.process = nil
		default:
			return nil
		}
	}
	m.stop()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return err
	}
	port := strings.Split(listener.Addr().String(), ":")[1]
	listener.Close()
	digest := strings.Split(model.ID, "-")[1]
	args := []string{"-m", filepath.Join(m.dir, digest+".gguf"), "--alias", "local", "--offline", "--host", "127.0.0.1", "--port", port, "--api-key", m.key, "--no-webui", "--no-agent", "--no-webui-mcp-proxy", "-np", "1", "-c", "8192", "--no-warmup"}
	if model.Kind == "Embedding" {
		args = append(args, "--embedding", "-ub", "8192", "-b", "8192")
	}
	if model.Projection != "" {
		args = append(args, "--mmproj", filepath.Join(m.dir, model.Projection+".gguf"))
	}
	if runtime.GOOS == "windows" || runtime.GOOS == "linux" {
		args = append(args, "-ngl", "0", "--no-mmproj-offload")
	}
	m.log, err = os.OpenFile(filepath.Join(m.dir, "engine.log"), os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0600)
	if err != nil {
		return err
	}
	cmd := exec.Command(m.engine, args...)
	hideWindow(cmd)
	for _, entry := range os.Environ() {
		if !strings.HasPrefix(entry, "LLAMA_ARG_") && !strings.HasPrefix(entry, "HF_HUB_OFFLINE=") {
			cmd.Env = append(cmd.Env, entry)
		}
	}
	cmd.Env = append(cmd.Env, "HF_HUB_OFFLINE=1")
	cmd.Stdout = m.log
	cmd.Stderr = m.log
	if err = cmd.Start(); err != nil {
		m.log.Close()
		m.log = nil
		return fmt.Errorf("无法启动随附模型引擎: %w", err)
	}
	m.process = cmd
	m.done = make(chan error, 1)
	go func() { m.done <- cmd.Wait() }()
	m.loaded = model.ID
	m.upstream = "http://127.0.0.1:" + port
	healthClient := &http.Client{Transport: &http.Transport{Proxy: nil}, Timeout: 2 * time.Second}
	timer := time.NewTimer(3 * time.Minute)
	defer timer.Stop()
	ticker := time.NewTicker(250 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			m.stop()
			return ctx.Err()
		case <-timer.C:
			m.stop()
			return fmt.Errorf("模型加载超时，请检查内存和 engine.log")
		case err := <-m.done:
			m.process = nil
			m.stop()
			return fmt.Errorf("模型启动失败: %v；请检查 engine.log", err)
		case <-ticker.C:
			req, _ := http.NewRequestWithContext(ctx, "GET", m.upstream+"/health", nil)
			req.Header.Set("Authorization", "Bearer "+m.key)
			res, err := healthClient.Do(req)
			if err == nil {
				res.Body.Close()
				if res.StatusCode == 200 {
					return nil
				}
			}
		}
	}
}

func (m *Manager) stop() {
	if m.process != nil {
		_ = m.process.Process.Kill()
		<-m.done
		m.process = nil
	}
	if m.log != nil {
		m.log.Close()
		m.log = nil
	}
	m.loaded = ""
}

func (m *Manager) SetPrimary(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, model := range m.models {
		if model.ID == id && model.Kind == "KnowledgeQA" {
			old := m.primary
			m.primary = id
			if err := m.save(); err != nil {
				m.primary = old
				return err
			}
			return nil
		}
	}
	return fmt.Errorf("请选择已导入的文字模型")
}

func (m *Manager) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")), []byte("Bearer "+m.key)) != 1 {
		http.Error(w, "unauthorized", 401)
		return
	}
	// One inference process limits memory use; keep its lease through streaming.
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.closed {
		http.Error(w, "application closing", 503)
		return
	}
	parts := strings.SplitN(strings.TrimPrefix(r.URL.Path, "/"), "/", 2)
	if len(parts) != 2 {
		http.NotFound(w, r)
		return
	}
	id := parts[0]
	if id == "primary" {
		id = m.primary
	}
	if id == "vision" {
		for _, model := range m.models {
			if model.Kind == "VLLM" {
				id = model.ID
			}
		}
	}
	var selected *Model
	for i := range m.models {
		if m.models[i].ID == id {
			selected = &m.models[i]
			break
		}
	}
	if selected == nil {
		http.Error(w, "请在离线模型页面导入并选择模型", 503)
		return
	}
	allowed := parts[1] == "v1/chat/completions" || parts[1] == "v1/embeddings" || parts[1] == "v1/models"
	if !allowed {
		http.NotFound(w, r)
		return
	}
	if err := m.start(r.Context(), *selected); err != nil {
		http.Error(w, err.Error(), 503)
		return
	}
	if selected.Kind == "Embedding" && parts[1] == "v1/embeddings" && r.Method == http.MethodPost {
		if err := m.prepareEmbeddings(r); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	}
	target, _ := url.Parse(m.upstream)
	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.Transport = &http.Transport{Proxy: nil}
	defer proxy.Transport.(*http.Transport).CloseIdleConnections()
	proxy.FlushInterval = -1
	r.URL.Path = "/" + parts[1]
	proxy.ServeHTTP(w, r)
}

func (m *Manager) Close() {
	_ = m.server.Close()
	m.mu.Lock()
	defer m.mu.Unlock()
	m.closed = true
	m.stop()
}
