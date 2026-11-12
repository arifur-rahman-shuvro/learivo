package httpapi

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type fakeVerifier struct{}

func (fakeVerifier) Verify(_ context.Context, token string) (Identity, error) {
	if token == "good" {
		return Identity{UserID: "user-1"}, nil
	}
	return Identity{}, errors.New("bad token")
}

func quiet() *slog.Logger { return slog.New(slog.NewTextHandler(io.Discard, nil)) }

func do(h http.Handler, method, path string, headers map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, nil)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	return rr
}

func TestHealthz(t *testing.T) {
	h := New(Options{Logger: quiet(), Version: "t1"})
	rr := do(h, "GET", "/healthz", nil)
	if rr.Code != 200 || !strings.Contains(rr.Body.String(), `"ok"`) {
		t.Fatalf("got %d %s", rr.Code, rr.Body.String())
	}
	if rr.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatal("missing security header")
	}
}

func TestMeRequiresValidToken(t *testing.T) {
	h := New(Options{Logger: quiet(), Verifier: fakeVerifier{}})

	cases := []struct {
		name    string
		headers map[string]string
		want    int
	}{
		{"no header", nil, 401},
		{"wrong scheme", map[string]string{"Authorization": "Basic abc"}, 401},
		{"empty bearer", map[string]string{"Authorization": "Bearer "}, 401},
		{"bad token", map[string]string{"Authorization": "Bearer nope"}, 401},
		{"good token", map[string]string{"Authorization": "Bearer good"}, 200},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := do(h, "GET", "/v1/me", c.headers).Code; got != c.want {
				t.Fatalf("want %d got %d", c.want, got)
			}
		})
	}
}

func TestMeReturnsVerifiedIdentity(t *testing.T) {
	h := New(Options{Logger: quiet(), Verifier: fakeVerifier{}})
	rr := do(h, "GET", "/v1/me", map[string]string{"Authorization": "Bearer good"})
	if !strings.Contains(rr.Body.String(), "user-1") {
		t.Fatalf("identity missing: %s", rr.Body.String())
	}
}

func TestProtectedRouteFailsClosedWithoutVerifier(t *testing.T) {
	h := New(Options{Logger: quiet()})
	rr := do(h, "GET", "/v1/me", map[string]string{"Authorization": "Bearer good"})
	if rr.Code != 503 {
		t.Fatalf("want 503 when no verifier configured, got %d", rr.Code)
	}
}

func TestCORSOnlyAllowsListedOrigins(t *testing.T) {
	h := New(Options{Logger: quiet(), AllowedOrigins: []string{"https://app.example"}})

	ok := do(h, "GET", "/healthz", map[string]string{"Origin": "https://app.example"})
	if ok.Header().Get("Access-Control-Allow-Origin") != "https://app.example" {
		t.Fatal("allowed origin was not echoed")
	}
	bad := do(h, "GET", "/healthz", map[string]string{"Origin": "https://evil.example"})
	if bad.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatal("unlisted origin must not be allowed")
	}
	pre := do(h, "OPTIONS", "/v1/me", map[string]string{"Origin": "https://app.example"})
	if pre.Code != 204 {
		t.Fatalf("preflight want 204 got %d", pre.Code)
	}
}

func TestPanicIsContained(t *testing.T) {
	h := recoverPanic(quiet(), http.HandlerFunc(func(http.ResponseWriter, *http.Request) { panic("boom") }))
	rr := do(h, "GET", "/", nil)
	if rr.Code != 500 || strings.Contains(rr.Body.String(), "boom") {
		t.Fatalf("panic must return generic 500, got %d %s", rr.Code, rr.Body.String())
	}
}
