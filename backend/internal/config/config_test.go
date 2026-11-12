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
	if _, err := Load(env(map[string]string{
		"LEARIVO_ENV":          "production",
		"LEARIVO_SUPABASE_URL": "https://project.supabase.co",
	})); err == nil {
		t.Fatal("expected error when production has no allowed origins")
	}
	cfg, err := Load(env(map[string]string{
		"LEARIVO_ENV":             "production",
		"LEARIVO_SUPABASE_URL":    "https://project.supabase.co",
		"LEARIVO_ALLOWED_ORIGINS": "https://a.example, https://b.example",
	}))
	if err != nil {
		t.Fatal(err)
	}
	if len(cfg.AllowedOrigins) != 2 || cfg.AllowedOrigins[1] != "https://b.example" {
		t.Fatalf("origins not parsed: %+v", cfg.AllowedOrigins)
	}
}

func TestSupabaseSettings(t *testing.T) {
	env := map[string]string{
		"LEARIVO_SUPABASE_URL":        "https://project.supabase.co/",
		"LEARIVO_SUPABASE_JWT_SECRET": "s3cret",
	}
	cfg, err := Load(func(k string) (string, bool) { v, ok := env[k]; return v, ok })
	if err != nil {
		t.Fatal(err)
	}
	if cfg.SupabaseURL != "https://project.supabase.co" || cfg.SupabaseJWTSecret != "s3cret" {
		t.Fatalf("unexpected config: %+v", cfg)
	}
}

func TestProductionRequiresSupabaseURL(t *testing.T) {
	env := map[string]string{"LEARIVO_ENV": "production", "LEARIVO_ALLOWED_ORIGINS": "https://learivo.pages.dev"}
	if _, err := Load(func(k string) (string, bool) { v, ok := env[k]; return v, ok }); err == nil {
		t.Fatal("expected an error when the Supabase URL is missing in production")
	}
}
