// Package auth verifies Supabase-issued access tokens (JWTs) using only the standard library.
//
// Rules enforced on every token:
//   - the signing algorithm is chosen by our key, never by the token header;
//   - "none" and any algorithm we did not configure are rejected;
//   - issuer, audience, expiry and a non-empty subject are required.
package auth

import (
	"context"
	"crypto"
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/elliptic"
	"crypto/hmac"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"
)

// ErrInvalidToken is returned for every verification failure. Callers must not reveal why.
var ErrInvalidToken = errors.New("invalid token")

// Identity is the verified caller.
type Identity struct{ UserID string }

// Config describes how to verify tokens for one Supabase project.
type Config struct {
	// SupabaseURL is the project URL, for example https://abcd.supabase.co.
	SupabaseURL string
	// HS256Secret enables legacy shared-secret tokens. Leave empty to reject HS256.
	HS256Secret []byte
	// HTTPClient fetches the signing keys. Defaults to a client with a 5s timeout.
	HTTPClient *http.Client
	// Now returns the current time. Defaults to time.Now.
	Now func() time.Time
	// KeyCacheTTL is how long fetched keys are trusted. Defaults to 10 minutes.
	KeyCacheTTL time.Duration
	// Leeway tolerates small clock differences. Defaults to 30 seconds.
	Leeway time.Duration
}

// Verifier checks bearer tokens against the project's published signing keys.
type Verifier struct {
	issuer   string
	jwksURL  string
	secret   []byte
	client   *http.Client
	now      func() time.Time
	ttl      time.Duration
	leeway   time.Duration
	mu       sync.Mutex
	keys     map[string]jwk
	fetched  time.Time
	lastMiss time.Time
}

// NewVerifier validates the configuration and builds a Verifier.
func NewVerifier(c Config) (*Verifier, error) {
	base := strings.TrimRight(strings.TrimSpace(c.SupabaseURL), "/")
	if !strings.HasPrefix(base, "https://") && !strings.HasPrefix(base, "http://localhost") && !strings.HasPrefix(base, "http://127.0.0.1") {
		return nil, errors.New("SupabaseURL must be an https URL")
	}
	v := &Verifier{
		issuer:  base + "/auth/v1",
		jwksURL: base + "/auth/v1/.well-known/jwks.json",
		secret:  c.HS256Secret,
		client:  c.HTTPClient,
		now:     c.Now,
		ttl:     c.KeyCacheTTL,
		leeway:  c.Leeway,
	}
	if v.client == nil {
		v.client = &http.Client{Timeout: 5 * time.Second}
	}
	if v.now == nil {
		v.now = time.Now
	}
	if v.ttl == 0 {
		v.ttl = 10 * time.Minute
	}
	if v.leeway == 0 {
		v.leeway = 30 * time.Second
	}
	return v, nil
}

type header struct {
	Alg string `json:"alg"`
	Kid string `json:"kid"`
	Typ string `json:"typ"`
}

type claims struct {
	Sub string          `json:"sub"`
	Iss string          `json:"iss"`
	Aud json.RawMessage `json:"aud"`
	Exp float64         `json:"exp"`
	Nbf float64         `json:"nbf"`
	Rol string          `json:"role"`
}

// Verify checks the token and returns the caller's identity.
func (v *Verifier) Verify(ctx context.Context, token string) (Identity, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 || len(token) > 8192 {
		return Identity{}, ErrInvalidToken
	}
	hdrBytes, err1 := b64(parts[0])
	payload, err2 := b64(parts[1])
	sig, err3 := b64(parts[2])
	if err1 != nil || err2 != nil || err3 != nil {
		return Identity{}, ErrInvalidToken
	}
	var h header
	if json.Unmarshal(hdrBytes, &h) != nil {
		return Identity{}, ErrInvalidToken
	}
	signed := []byte(parts[0] + "." + parts[1])

	switch h.Alg {
	case "HS256":
		if len(v.secret) == 0 {
			return Identity{}, ErrInvalidToken
		}
		mac := hmac.New(sha256.New, v.secret)
		mac.Write(signed)
		if !hmac.Equal(mac.Sum(nil), sig) {
			return Identity{}, ErrInvalidToken
		}
	case "ES256", "RS256", "EdDSA":
		key, err := v.keyFor(ctx, h.Kid)
		if err != nil || !key.verify(h.Alg, signed, sig) {
			return Identity{}, ErrInvalidToken
		}
	default:
		return Identity{}, ErrInvalidToken
	}

	var c claims
	if json.Unmarshal(payload, &c) != nil {
		return Identity{}, ErrInvalidToken
	}
	now := v.now()
	if c.Iss != v.issuer || c.Sub == "" || !audienceHas(c.Aud, "authenticated") {
		return Identity{}, ErrInvalidToken
	}
	if c.Exp == 0 || now.After(time.Unix(int64(c.Exp), 0).Add(v.leeway)) {
		return Identity{}, ErrInvalidToken
	}
	if c.Nbf != 0 && now.Add(v.leeway).Before(time.Unix(int64(c.Nbf), 0)) {
		return Identity{}, ErrInvalidToken
	}
	if c.Rol != "authenticated" {
		return Identity{}, ErrInvalidToken
	}
	return Identity{UserID: c.Sub}, nil
}

func b64(s string) ([]byte, error) { return base64.RawURLEncoding.DecodeString(s) }

func audienceHas(raw json.RawMessage, want string) bool {
	var one string
	if json.Unmarshal(raw, &one) == nil {
		return one == want
	}
	var many []string
	if json.Unmarshal(raw, &many) == nil {
		for _, a := range many {
			if a == want {
				return true
			}
		}
	}
	return false
}

// ---- signing keys (JWKS) ----

type jwk struct {
	Kty string `json:"kty"`
	Kid string `json:"kid"`
	Crv string `json:"crv"`
	X   string `json:"x"`
	Y   string `json:"y"`
	N   string `json:"n"`
	E   string `json:"e"`
}

func (v *Verifier) keyFor(ctx context.Context, kid string) (jwk, error) {
	if kid == "" {
		return jwk{}, ErrInvalidToken
	}
	v.mu.Lock()
	defer v.mu.Unlock()
	now := v.now()
	if k, ok := v.keys[kid]; ok && now.Sub(v.fetched) < v.ttl {
		return k, nil
	}
	// Unknown key id: refresh, but at most once a minute so bad tokens cannot hammer the auth server.
	if !v.lastMiss.IsZero() && now.Sub(v.lastMiss) < time.Minute {
		return jwk{}, ErrInvalidToken
	}
	v.lastMiss = now
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.jwksURL, nil)
	if err != nil {
		return jwk{}, err
	}
	resp, err := v.client.Do(req)
	if err != nil {
		return jwk{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return jwk{}, fmt.Errorf("jwks status %d", resp.StatusCode)
	}
	var set struct {
		Keys []jwk `json:"keys"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&set); err != nil {
		return jwk{}, err
	}
	keys := make(map[string]jwk, len(set.Keys))
	for _, k := range set.Keys {
		if k.Kid != "" {
			keys[k.Kid] = k
		}
	}
	v.keys, v.fetched = keys, now
	if k, ok := keys[kid]; ok {
		return k, nil
	}
	return jwk{}, ErrInvalidToken
}

// verify checks the signature. The key type must match the algorithm in the header.
func (k jwk) verify(alg string, signed, sig []byte) bool {
	sum := sha256.Sum256(signed)
	switch {
	case alg == "ES256" && k.Kty == "EC" && k.Crv == "P-256":
		x, errx := bigFrom(k.X)
		y, erry := bigFrom(k.Y)
		if errx != nil || erry != nil || len(sig) != 64 {
			return false
		}
		pub := ecdsa.PublicKey{Curve: elliptic.P256(), X: x, Y: y}
		if !pub.Curve.IsOnCurve(x, y) {
			return false
		}
		return ecdsa.Verify(&pub, sum[:], new(big.Int).SetBytes(sig[:32]), new(big.Int).SetBytes(sig[32:]))
	case alg == "RS256" && k.Kty == "RSA":
		n, errn := bigFrom(k.N)
		e, erre := bigFrom(k.E)
		if errn != nil || erre != nil || !e.IsInt64() || n.BitLen() < 2048 {
			return false
		}
		pub := rsa.PublicKey{N: n, E: int(e.Int64())}
		return rsa.VerifyPKCS1v15(&pub, crypto.SHA256, sum[:], sig) == nil
	case alg == "EdDSA" && k.Kty == "OKP" && k.Crv == "Ed25519":
		x, err := b64(k.X)
		if err != nil || len(x) != ed25519.PublicKeySize {
			return false
		}
		return ed25519.Verify(ed25519.PublicKey(x), signed, sig)
	}
	return false
}

func bigFrom(s string) (*big.Int, error) {
	b, err := b64(s)
	if err != nil || len(b) == 0 {
		return nil, errors.New("bad number")
	}
	return new(big.Int).SetBytes(b), nil
}
