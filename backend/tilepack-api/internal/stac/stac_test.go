package stac

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestItemAssetUnmarshalCoercion(t *testing.T) {
	tests := []struct {
		name         string
		payload      string
		wantFileSize int64
		wantProjCode int
	}{
		{
			name:         "integers",
			payload:      `{"href":"https://example.test/a.pmtiles","file:size":123,"proj:code":3857}`,
			wantFileSize: 123,
			wantProjCode: 3857,
		},
		{
			name:         "integral floats",
			payload:      `{"href":"https://example.test/a.pmtiles","file:size":123.0,"proj:code":3857.0}`,
			wantFileSize: 123,
			wantProjCode: 3857,
		},
		{
			name:         "numeric strings",
			payload:      `{"href":"https://example.test/a.pmtiles","file:size":"123","proj:code":"3857"}`,
			wantFileSize: 123,
			wantProjCode: 3857,
		},
		{
			name:         "float strings",
			payload:      `{"href":"https://example.test/a.pmtiles","file:size":"123.0","proj:code":"3857.0"}`,
			wantFileSize: 123,
			wantProjCode: 3857,
		},
		{
			name:         "null values",
			payload:      `{"href":"https://example.test/a.pmtiles","file:size":null,"proj:code":null}`,
			wantFileSize: 0,
			wantProjCode: 0,
		},
		{
			name:         "empty strings",
			payload:      `{"href":"https://example.test/a.pmtiles","file:size":"","proj:code":""}`,
			wantFileSize: 0,
			wantProjCode: 0,
		},
		{
			name:         "unparsable strings",
			payload:      `{"href":"https://example.test/a.pmtiles","file:size":"abc","proj:code":"x"}`,
			wantFileSize: 0,
			wantProjCode: 0,
		},
		{
			name:         "fractional numbers",
			payload:      `{"href":"https://example.test/a.pmtiles","file:size":123.5,"proj:code":3857.5}`,
			wantFileSize: 0,
			wantProjCode: 0,
		},
		{
			name:         "wrong types",
			payload:      `{"href":"https://example.test/a.pmtiles","file:size":{},"proj:code":[]}`,
			wantFileSize: 0,
			wantProjCode: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var a ItemAsset
			if err := json.Unmarshal([]byte(tt.payload), &a); err != nil {
				t.Fatalf("json.Unmarshal() error = %v", err)
			}
			if a.FileSize != tt.wantFileSize {
				t.Fatalf("FileSize = %d, want %d", a.FileSize, tt.wantFileSize)
			}
			if a.ProjCode != tt.wantProjCode {
				t.Fatalf("ProjCode = %d, want %d", a.ProjCode, tt.wantProjCode)
			}
		})
	}
}

func TestItemAssetUnmarshalStructurallyInvalidObject(t *testing.T) {
	var a ItemAsset
	if err := json.Unmarshal([]byte(`"not-an-object"`), &a); err == nil {
		t.Fatal("expected unmarshal error for invalid asset object")
	}
}

func TestGetItem_MixedAssetValueTypes(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"id":"item-1",
			"collection":"demo",
			"assets":{
				"pmtiles":{
					"href":"https://example.test/item-1.pmtiles",
					"type":"application/vnd.pmtiles",
					"roles":["tiles"],
					"title":"PMTILES archive",
					"file:size":"2048",
					"proj:code":3857.0
				}
			}
		}`))
	}))
	defer ts.Close()

	c := New(ts.URL, "demo")
	item, err := c.GetItem(context.Background(), "item-1")
	if err != nil {
		t.Fatalf("GetItem() error = %v", err)
	}
	asset := item.Assets["pmtiles"]
	if asset.FileSize != 2048 {
		t.Fatalf("FileSize = %d, want 2048", asset.FileSize)
	}
	if asset.ProjCode != 3857 {
		t.Fatalf("ProjCode = %d, want 3857", asset.ProjCode)
	}
}
