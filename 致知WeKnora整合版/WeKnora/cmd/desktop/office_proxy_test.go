package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestOfficeProxyForwardsUnknownLengthWebViewJSON(t *testing.T) {
	body := `{"action":"generate","sample":"清晨，阳光洒满窗台。","topic":"写读书活动"}`
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Match the office service's fixed-length request reader.
		if r.ContentLength <= 0 || r.Header.Get("Content-Length") == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		require.Equal(t, "/api", r.URL.Path)
		require.Equal(t, "http://"+r.Host, r.Header.Get("Origin"))
		require.Equal(t, "test-session", r.Header.Get("X-Session"))
		got, err := io.ReadAll(io.LimitReader(r.Body, r.ContentLength))
		require.NoError(t, err)
		require.Equal(t, body, string(got))
		w.WriteHeader(http.StatusNoContent)
	}))
	defer backend.Close()
	target, err := url.Parse(backend.URL)
	require.NoError(t, err)
	officeProcesses["writer"] = &officeProcess{target: target}
	defer delete(officeProcesses, "writer")
	req := httptest.NewRequest(http.MethodPost, "/zhizhi/writer/api", io.NopCloser(strings.NewReader(body)))
	req.ContentLength = -1
	req.TransferEncoding = []string{"chunked"}
	req.Header.Set("X-Session", "test-session")
	response := httptest.NewRecorder()
	withOffice(http.NotFoundHandler()).ServeHTTP(response, req)
	require.Equal(t, http.StatusNoContent, response.Code)
}
