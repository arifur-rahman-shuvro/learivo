// Command api runs the Learivo HTTP API.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/arifur-rahman-shuvro/learivo/backend/internal/auth"
	"github.com/arifur-rahman-shuvro/learivo/backend/internal/config"
	"github.com/arifur-rahman-shuvro/learivo/backend/internal/httpapi"
)

// version is set at build time with -ldflags "-X main.version=...".
var version = "dev"

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	cfg, err := config.FromOS()
	if err != nil {
		log.Error("invalid configuration", "error", err)
		os.Exit(1)
	}

	// Without a Supabase URL there is no way to verify tokens, so protected routes answer 503.
	var verifier httpapi.TokenVerifier
	if cfg.SupabaseURL != "" {
		v, err := auth.NewVerifier(auth.Config{SupabaseURL: cfg.SupabaseURL, HS256Secret: []byte(cfg.SupabaseJWTSecret)})
		if err != nil {
			log.Error("invalid Supabase URL", "error", err)
			os.Exit(1)
		}
		verifier = tokenAdapter{v}
	} else {
		log.Warn("LEARIVO_SUPABASE_URL not set: protected routes are disabled")
	}

	srv := &http.Server{
		Addr: cfg.Addr,
		Handler: httpapi.New(httpapi.Options{
			Verifier:       verifier,
			AllowedOrigins: cfg.AllowedOrigins,
			Logger:         log,
			Version:        version,
		}),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 16,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		log.Info("listening", "addr", cfg.Addr, "env", cfg.Env, "version", version)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("server failed", "error", err)
			stop()
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error("shutdown error", "error", err)
		os.Exit(1)
	}
	log.Info("stopped")
}

// tokenAdapter connects the auth package to the HTTP layer's TokenVerifier interface.
type tokenAdapter struct{ v *auth.Verifier }

func (a tokenAdapter) Verify(ctx context.Context, token string) (httpapi.Identity, error) {
	id, err := a.v.Verify(ctx, token)
	return httpapi.Identity{UserID: id.UserID}, err
}
