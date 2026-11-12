package auth

import (
	"context"
	"crypto"
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/elliptic"
	"crypto/hmac"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

const (
	testURL = "https://project.supabase.co"
	issuer  = testURL + "/auth/v1"
)

var t0 = time.Date(2026, 11, 12, 12, 0, 0, 0, time.UTC)

func enc(b []byte) string { return base64.RawURLEncoding.EncodeToString(b) }

func jsonB(t *testing.T, v any) []byte {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func goodClaims() map[string]any {
	return map[string]any{
		"sub": "11111111-1111-1111-1111-111111111111", "iss": issuer, "aud": "authenticated",
		"role": "authenticated", "exp": t0.Add(time.Hour).Unix(),
	}
}

// signer builds a token with an arbitrary header and claims.
type signer struct {
	t    *testing.T
	sign func(alg string, signed []byte) []byte
}

func (s signer) token(hdr, cl map[string]any) string {
	signed := enc(jsonB(s.t, hdr)) + "." + enc(jsonB(s.t, cl))
	alg, _ := hdr["alg"].(string)
	return signed + "." + enc(s.sign(alg, []byte(signed)))
}

type fixture struct {
	t        *testing.T
	ec       *ecdsa.PrivateKey
	rsaKey   *rsa.PrivateKey
	edPub    ed25519.PublicKey
	edPriv   ed25519.PrivateKey
	server   *httptest.Server
	fetches  atomic.Int32
	jwksJSON atomic.Value
	secret   []byte
}

func newFixture(t *testing.T) *fixture {
	t.Helper()
	f := &fixture{t: t, secret: []byte("legacy-shared-secret-at-least-32-bytes!")}
	var err error
	if f.ec, err = ecdsa.GenerateKey(elliptic.P256(), rand.Reader); err != nil {
		t.Fatal(err)
	}
	if f.rsaKey, err = rsa.GenerateKey(rand.Reader, 2048); err != nil {
		t.Fatal(err)
	}
	if f.edPub, f.edPriv, err = ed25519.GenerateKey(rand.Reader); err != nil {
		t.Fatal(err)
	}
	f.setKeys("ec-1", "rsa-1", "ed-1")
	f.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		f.fetches.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(f.jwksJSON.Load().([]byte))
	}))
	t.Cleanup(f.server.Close)
	return f
}

func (f *fixture) setKeys(ecKid, rsaKid, edKid string) {
	pad := func(b []byte, n int) []byte { return append(make([]byte, n-len(b)), b...) }
	f.jwksJSON.Store(jsonB(f.t, map[string]any{"keys": []map[string]string{
		{"kty": "EC", "crv": "P-256", "kid": ecKid, "x": enc(pad(f.ec.X.Bytes(), 32)), "y": enc(pad(f.ec.Y.Bytes(), 32))},
		{"kty": "RSA", "kid": rsaKid, "n": enc(f.rsaKey.N.Bytes()), "e": enc([]byte{1, 0, 1})},
		{"kty": "OKP", "crv": "Ed25519", "kid": edKid, "x": enc(f.edPub)},
	}}))
}

func (f *fixture) verifier(secret bool) *Verifier {
	f.t.Helper()
	cfg := Config{SupabaseURL: testURL, Now: func() time.Time { return t0 }, HTTPClient: &http.Client{Transport: rewrite{f.server.URL}}}
	if secret {
		cfg.HS256Secret = f.secret
	}
	v, err := NewVerifier(cfg)
	if err != nil {
		f.t.Fatal(err)
	}
	return v
}

// rewrite sends every request to the test server, whatever host it names.
type rewrite struct{ target string }

func (r rewrite) RoundTrip(req *http.Request) (*http.Response, error) {
	u := *req.URL
	tu, _ := http.NewRequest(http.MethodGet, r.target, nil)
	u.Scheme, u.Host = tu.URL.Scheme, tu.URL.Host
	req2 := req.Clone(req.Context())
	req2.URL = &u
	return http.DefaultTransport.RoundTrip(req2)
}

func (f *fixture) signer() signer {
	return signer{t: f.t, sign: func(alg string, signed []byte) []byte {
		sum := sha256.Sum256(signed)
		switch alg {
		case "ES256":
			r, s, err := ecdsa.Sign(rand.Reader, f.ec, sum[:])
			if err != nil {
				f.t.Fatal(err)
			}
			out := make([]byte, 64)
			r.FillBytes(out[:32])
			s.FillBytes(out[32:])
			return out
		case "RS256":
			sig, err := rsa.SignPKCS1v15(rand.Reader, f.rsaKey, crypto.SHA256, sum[:])
			if err != nil {
				f.t.Fatal(err)
			}
			return sig
		case "EdDSA":
			return ed25519.Sign(f.edPriv, signed)
		case "HS256":
			m := hmac.New(sha256.New, f.secret)
			m.Write(signed)
			return m.Sum(nil)
		}
		return []byte("unsigned")
	}}
}

func TestValidTokensForEveryAlgorithm(t *testing.T) {
	f := newFixture(t)
	v := f.verifier(true)
	s := f.signer()
	cases := []struct {
		alg, kid string
	}{{"ES256", "ec-1"}, {"RS256", "rsa-1"}, {"EdDSA", "ed-1"}, {"HS256", ""}}
	for _, c := range cases {
		t.Run(c.alg, func(t *testing.T) {
			id, err := v.Verify(context.Background(), s.token(map[string]any{"alg": c.alg, "kid": c.kid, "typ": "JWT"}, goodClaims()))
			if err != nil || id.UserID != "11111111-1111-1111-1111-111111111111" {
				t.Fatalf("got %v, %v", id, err)
			}
		})
	}
}

func TestRejectsBadTokens(t *testing.T) {
	f := newFixture(t)
	v := f.verifier(false) // HS256 not enabled
	s := f.signer()
	es := map[string]any{"alg": "ES256", "kid": "ec-1"}

	with := func(key string, val any) map[string]any {
		c := goodClaims()
		if val == nil {
			delete(c, key)
		} else {
			c[key] = val
		}
		return c
	}
	tokenOf := func(hdr, cl map[string]any) string { return s.token(hdr, cl) }

	tampered := func() string {
		tok := tokenOf(es, goodClaims())
		return tok[:len(tok)-2] + "AA"
	}()

	cases := map[string]string{
		"expired":           tokenOf(es, with("exp", t0.Add(-time.Hour).Unix())),
		"no expiry":         tokenOf(es, with("exp", nil)),
		"wrong issuer":      tokenOf(es, with("iss", "https://evil.example/auth/v1")),
		"wrong audience":    tokenOf(es, with("aud", "other")),
		"no subject":        tokenOf(es, with("sub", nil)),
		"anon role":         tokenOf(es, with("role", "anon")),
		"not yet valid":     tokenOf(es, with("nbf", t0.Add(time.Hour).Unix())),
		"alg none":          tokenOf(map[string]any{"alg": "none", "kid": "ec-1"}, goodClaims()),
		"unknown alg":       tokenOf(map[string]any{"alg": "HS512", "kid": "ec-1"}, goodClaims()),
		"HS256 not enabled": tokenOf(map[string]any{"alg": "HS256"}, goodClaims()),
		"unknown key id":    tokenOf(map[string]any{"alg": "ES256", "kid": "nope"}, goodClaims()),
		"missing key id":    tokenOf(map[string]any{"alg": "ES256"}, goodClaims()),
		"alg/key mismatch":  tokenOf(map[string]any{"alg": "ES256", "kid": "rsa-1"}, goodClaims()),
		"tampered":          tampered,
		"garbage":           "not-a-token",
		"empty":             "",
		"two parts":         "a.b",
	}
	for name, tok := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := v.Verify(context.Background(), tok); !errors.Is(err, ErrInvalidToken) {
				t.Fatalf("expected ErrInvalidToken, got %v", err)
			}
		})
	}
}

func TestAudienceMayBeAList(t *testing.T) {
	f := newFixture(t)
	v := f.verifier(false)
	c := goodClaims()
	c["aud"] = []string{"x", "authenticated"}
	if _, err := v.Verify(context.Background(), f.signer().token(map[string]any{"alg": "ES256", "kid": "ec-1"}, c)); err != nil {
		t.Fatal(err)
	}
}

func TestKeysAreCachedAndRefetchIsThrottled(t *testing.T) {
	f := newFixture(t)
	v := f.verifier(false)
	s := f.signer()
	good := s.token(map[string]any{"alg": "ES256", "kid": "ec-1"}, goodClaims())
	for i := 0; i < 5; i++ {
		if _, err := v.Verify(context.Background(), good); err != nil {
			t.Fatal(err)
		}
	}
	if n := f.fetches.Load(); n != 1 {
		t.Fatalf("expected 1 key fetch, got %d", n)
	}
	// A flood of tokens with unknown key ids must not trigger a flood of fetches.
	for i := 0; i < 20; i++ {
		_, _ = v.Verify(context.Background(), s.token(map[string]any{"alg": "ES256", "kid": "unknown"}, goodClaims()))
	}
	if n := f.fetches.Load(); n > 2 {
		t.Fatalf("expected throttled fetches, got %d", n)
	}
}

func TestKeyRotationIsPickedUpAfterThrottleWindow(t *testing.T) {
	f := newFixture(t)
	now := t0
	cfg := Config{SupabaseURL: testURL, Now: func() time.Time { return now }, HTTPClient: &http.Client{Transport: rewrite{f.server.URL}}}
	v, _ := NewVerifier(cfg)
	s := f.signer()
	if _, err := v.Verify(context.Background(), s.token(map[string]any{"alg": "ES256", "kid": "ec-1"}, goodClaims())); err != nil {
		t.Fatal(err)
	}
	f.setKeys("ec-2", "rsa-1", "ed-1")
	rotated := s.token(map[string]any{"alg": "ES256", "kid": "ec-2"}, goodClaims())
	now = now.Add(2 * time.Minute)
	if _, err := v.Verify(context.Background(), rotated); err != nil {
		t.Fatalf("rotated key not accepted: %v", err)
	}
}

func TestKeyServerDownFailsClosed(t *testing.T) {
	f := newFixture(t)
	v := f.verifier(false)
	f.server.Close()
	tok := f.signer().token(map[string]any{"alg": "ES256", "kid": "ec-1"}, goodClaims())
	if _, err := v.Verify(context.Background(), tok); err == nil {
		t.Fatal("expected failure when keys cannot be fetched")
	}
}

func TestNewVerifierRejectsInsecureURL(t *testing.T) {
	if _, err := NewVerifier(Config{SupabaseURL: "http://example.com"}); err == nil {
		t.Fatal("expected error for non-https URL")
	}
}
