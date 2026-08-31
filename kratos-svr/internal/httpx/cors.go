package httpx

import (
	"net/http"
	"strings"
)

const (
	defaultAllowedMethods = "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS"
	defaultAllowedHeaders = "Accept, Authorization, Content-Type"
	defaultMaxAge         = "600"
)

// CORS allows browser clients from the configured origins to call an HTTP server.
func CORS(allowedOrigins []string) func(http.Handler) http.Handler {
	origins := make(map[string]struct{}, len(allowedOrigins))
	for _, origin := range allowedOrigins {
		origin = strings.TrimRight(strings.TrimSpace(origin), "/")
		if origin != "" {
			origins[origin] = struct{}{}
		}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := strings.TrimRight(strings.TrimSpace(r.Header.Get("Origin")), "/")
			if origin == "" {
				next.ServeHTTP(w, r)
				return
			}

			w.Header().Add("Vary", "Origin")
			if _, ok := origins[origin]; !ok {
				if r.Method == http.MethodOptions {
					http.Error(w, "origin is not allowed", http.StatusForbidden)
					return
				}
				next.ServeHTTP(w, r)
				return
			}

			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			if r.Method == http.MethodOptions {
				w.Header().Add("Vary", "Access-Control-Request-Method")
				w.Header().Add("Vary", "Access-Control-Request-Headers")
				w.Header().Set("Access-Control-Allow-Methods", defaultAllowedMethods)
				w.Header().Set("Access-Control-Allow-Headers", defaultAllowedHeaders)
				w.Header().Set("Access-Control-Max-Age", defaultMaxAge)
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
