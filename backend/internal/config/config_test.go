package config

import "testing"

func env(m map[string]string) func(string) (string, bool) {
	return func(k string) (string, bool) { v, ok := m[k]; return v, ok }
}

func TestDefaults(t *testing.T) {
	cfg, err := Load(env(nil))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Addr != ":8080" || cfg.Env != "development" {
		t.Fatalf("unexpected defaults: %+v", cfg)
	}
}

func TestRejectsUnknownEnv(t *testing.T) {
	if _, err := Load(env(map[string]string{"LEARIVO_ENV": "prod"})); err == nil {
		t.Fatal("expected error for unknown environment")
	}
}

func TestRejectsWildcardOrigin(t *testing.T) {
	if _, err := Load(env(map[string]string{"LEARIVO_ALLOWED_ORIGINS": "*"})); err == nil {
		t.Fatal("expected error for wildcard origin")
	}
}

func TestProductionRequiresOrigins(t *testing.T) {
	if _, err := Load(env(map[string]string{"LEARIVO_ENV": "production"})); err == nil {
		t.Fatal("expected error when production has no allowed origins")
	}
	cfg, err := Load(env(map[string]string{
		"LEARIVO_ENV":             "production",
		"LEARIVO_ALLOWED_ORIGINS": "https://a.example, https://b.example",
	}))
	if err != nil {
		t.Fatal(err)
	}
	if len(cfg.AllowedOrigins) != 2 || cfg.AllowedOrigins[1] != "https://b.example" {
		t.Fatalf("origins not parsed: %+v", cfg.AllowedOrigins)
	}
}
