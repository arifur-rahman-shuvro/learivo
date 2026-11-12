// Package config loads service settings from environment variables.
package config

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"time"
)

// Config holds all runtime settings. Secrets come only from the environment.
type Config struct {
	Addr            string
	Env             string // "development", "staging" or "production"
	AllowedOrigins  []string
	ShutdownTimeout time.Duration
}

// Load reads configuration from the given lookup function (os.LookupEnv in production).
func Load(lookup func(string) (string, bool)) (Config, error) {
	get := func(key, def string) string {
		if v, ok := lookup(key); ok && strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
		return def
	}

	cfg := Config{
		Addr:            get("LEARIVO_ADDR", ":8080"),
		Env:             get("LEARIVO_ENV", "development"),
		ShutdownTimeout: 10 * time.Second,
	}

	switch cfg.Env {
	case "development", "staging", "production":
	default:
		return Config{}, fmt.Errorf("LEARIVO_ENV must be development, staging or production, got %q", cfg.Env)
	}

	for _, o := range strings.Split(get("LEARIVO_ALLOWED_ORIGINS", ""), ",") {
		o = strings.TrimSpace(o)
		if o == "" {
			continue
		}
		if o == "*" {
			return Config{}, errors.New("LEARIVO_ALLOWED_ORIGINS must list explicit origins, not *")
		}
		cfg.AllowedOrigins = append(cfg.AllowedOrigins, o)
	}

	if cfg.Env == "production" && len(cfg.AllowedOrigins) == 0 {
		return Config{}, errors.New("LEARIVO_ALLOWED_ORIGINS is required in production")
	}

	return cfg, nil
}

// FromOS loads configuration from the process environment.
func FromOS() (Config, error) { return Load(os.LookupEnv) }
