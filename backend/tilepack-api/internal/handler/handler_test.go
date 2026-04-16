package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/hotosm/openaerialmap/backend/tilepack-api/internal/stac"
)

func TestCanonicalTilepackAsset(t *testing.T) {
	tests := []struct {
		name        string
		format      string
		href        string
		fileSize    int64
		wantType    string
		wantTitle   string
		wantHasSize bool
	}{
		{
			name:        "mbtiles with size",
			format:      "mbtiles",
			href:        "https://example.test/item.mbtiles",
			fileSize:    12345,
			wantType:    "application/vnd.mbtiles",
			wantTitle:   "MBTILES archive",
			wantHasSize: true,
		},
		{
			name:        "pmtiles without size",
			format:      "pmtiles",
			href:        "https://example.test/item.pmtiles",
			fileSize:    0,
			wantType:    "application/vnd.pmtiles",
			wantTitle:   "PMTILES archive",
			wantHasSize: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			asset := canonicalTilepackAsset(tt.format, tt.href, tt.fileSize)

			if asset.Href != tt.href {
				t.Fatalf("Href = %q, want %q", asset.Href, tt.href)
			}
			if asset.Type != tt.wantType {
				t.Fatalf("Type = %q, want %q", asset.Type, tt.wantType)
			}
			if asset.Title != tt.wantTitle {
				t.Fatalf("Title = %q, want %q", asset.Title, tt.wantTitle)
			}
			if len(asset.Roles) != 1 || asset.Roles[0] != "tiles" {
				t.Fatalf("Roles = %#v, want [\"tiles\"]", asset.Roles)
			}
			if asset.ProjCode != 3857 {
				t.Fatalf("ProjCode = %d, want 3857", asset.ProjCode)
			}
			if tt.wantHasSize {
				if asset.FileSize != tt.fileSize {
					t.Fatalf("FileSize = %d, want %d", asset.FileSize, tt.fileSize)
				}
			} else if asset.FileSize != 0 {
				t.Fatalf("FileSize = %d, want 0 when size is not positive", asset.FileSize)
			}
		})
	}
}

func TestTilepackAssetMatchesCanonical(t *testing.T) {
	canonical := canonicalTilepackAsset("pmtiles", "https://example.test/item.pmtiles", 123)

	tests := []struct {
		name     string
		existing stac.ItemAsset
		want     bool
	}{
		{
			name: "exact match",
			existing: stac.ItemAsset{
				Href:     canonical.Href,
				Type:     canonical.Type,
				Roles:    []string{"tiles"},
				Title:    canonical.Title,
				FileSize: canonical.FileSize,
				ProjCode: canonical.ProjCode,
			},
			want: true,
		},
		{
			name: "missing file size",
			existing: stac.ItemAsset{
				Href:     canonical.Href,
				Type:     canonical.Type,
				Roles:    []string{"tiles"},
				Title:    canonical.Title,
				ProjCode: canonical.ProjCode,
			},
			want: false,
		},
		{
			name: "missing proj code",
			existing: stac.ItemAsset{
				Href:     canonical.Href,
				Type:     canonical.Type,
				Roles:    []string{"tiles"},
				Title:    canonical.Title,
				FileSize: canonical.FileSize,
			},
			want: false,
		},
		{
			name: "roles mismatch",
			existing: stac.ItemAsset{
				Href:     canonical.Href,
				Type:     canonical.Type,
				Roles:    []string{"data"},
				Title:    canonical.Title,
				FileSize: canonical.FileSize,
				ProjCode: canonical.ProjCode,
			},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tilepackAssetMatchesCanonical(tt.existing, canonical)
			if got != tt.want {
				t.Fatalf("tilepackAssetMatchesCanonical() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestParseZooms(t *testing.T) {
	tests := []struct {
		name       string
		min        string
		max        string
		wantMin    int
		wantMax    int
		wantErrMsg string
	}{
		{name: "default zooms", min: "", max: "", wantMin: 0, wantMax: 0},
		{name: "explicit valid range", min: "3", max: "8", wantMin: 3, wantMax: 8},
		{name: "missing max", min: "3", max: "", wantErrMsg: "min_zoom and max_zoom must both be set"},
		{name: "invalid min", min: "x", max: "8", wantErrMsg: "min_zoom must be an integer"},
		{name: "invalid max", min: "3", max: "x", wantErrMsg: "max_zoom must be an integer"},
		{name: "min greater than max", min: "9", max: "8", wantErrMsg: "zoom must be 0..24 and min<=max"},
		{name: "out of range", min: "0", max: "25", wantErrMsg: "zoom must be 0..24 and min<=max"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotMin, gotMax, err := parseZooms(tt.min, tt.max)
			if tt.wantErrMsg != "" {
				if err == nil {
					t.Fatalf("parseZooms(%q, %q) expected error %q", tt.min, tt.max, tt.wantErrMsg)
				}
				if err.Error() != tt.wantErrMsg {
					t.Fatalf("error = %q, want %q", err.Error(), tt.wantErrMsg)
				}
				return
			}
			if err != nil {
				t.Fatalf("parseZooms(%q, %q) unexpected error: %v", tt.min, tt.max, err)
			}
			if gotMin != tt.wantMin || gotMax != tt.wantMax {
				t.Fatalf("got (%d, %d), want (%d, %d)", gotMin, gotMax, tt.wantMin, tt.wantMax)
			}
		})
	}
}

func TestBearerToken(t *testing.T) {
	tests := []struct {
		name      string
		header    string
		wantToken string
		wantOK    bool
	}{
		{name: "valid", header: "Bearer abc123", wantToken: "abc123", wantOK: true},
		{name: "valid with extra spaces", header: "Bearer   abc123   ", wantToken: "abc123", wantOK: true},
		{name: "wrong prefix", header: "Token abc123", wantToken: "", wantOK: false},
		{name: "missing token", header: "Bearer   ", wantToken: "", wantOK: false},
		{name: "empty", header: "", wantToken: "", wantOK: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotToken, gotOK := bearerToken(tt.header)
			if gotOK != tt.wantOK || gotToken != tt.wantToken {
				t.Fatalf("bearerToken(%q) = (%q, %v), want (%q, %v)", tt.header, gotToken, gotOK, tt.wantToken, tt.wantOK)
			}
		})
	}
}

func TestRoutes_Healthz(t *testing.T) {
	h := &Handler{}
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)

	h.Routes().ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusOK)
	}
	if strings.TrimSpace(rr.Body.String()) != "ok" {
		t.Fatalf("body = %q, want %q", rr.Body.String(), "ok")
	}
}

func TestPostTilepack_EarlyValidationPaths(t *testing.T) {
	tests := []struct {
		name       string
		url        string
		wantStatus int
		wantMsg    string
	}{
		{
			name:       "invalid stac id",
			url:        "/tilepacks/bad$id?format=pmtiles",
			wantStatus: http.StatusBadRequest,
			wantMsg:    "invalid stac id",
		},
		{
			name:       "invalid format",
			url:        "/tilepacks/valid_id-123?format=zip",
			wantStatus: http.StatusBadRequest,
			wantMsg:    "format must be pmtiles or mbtiles",
		},
		{
			name:       "missing max zoom",
			url:        "/tilepacks/valid_id-123?format=pmtiles&min_zoom=1",
			wantStatus: http.StatusBadRequest,
			wantMsg:    "min_zoom and max_zoom must both be set",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := &Handler{}
			rr := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPost, tt.url, nil)

			h.Routes().ServeHTTP(rr, req)

			if rr.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
			var resp response
			if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
				t.Fatalf("decode response: %v", err)
			}
			if resp.Message != tt.wantMsg {
				t.Fatalf("message = %q, want %q", resp.Message, tt.wantMsg)
			}
		})
	}
}

func TestClientIP(t *testing.T) {
	tests := []struct {
		name       string
		xff        string
		remoteAddr string
		want       string
	}{
		{
			name:       "uses first x-forwarded-for entry",
			xff:        "203.0.113.9, 10.0.0.1",
			remoteAddr: "192.0.2.1:54321",
			want:       "203.0.113.9",
		},
		{
			name:       "uses single x-forwarded-for value with spaces",
			xff:        "   203.0.113.11   ",
			remoteAddr: "192.0.2.1:54321",
			want:       "203.0.113.11",
		},
		{
			name:       "falls back to remote host",
			xff:        "",
			remoteAddr: "192.0.2.77:8080",
			want:       "192.0.2.77",
		},
		{
			name:       "returns raw remote addr on split failure",
			xff:        "",
			remoteAddr: "not-a-host-port",
			want:       "not-a-host-port",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			req.Header.Set("X-Forwarded-For", tt.xff)
			req.RemoteAddr = tt.remoteAddr
			got := clientIP(req)
			if got != tt.want {
				t.Fatalf("clientIP() = %q, want %q", got, tt.want)
			}
		})
	}
}
