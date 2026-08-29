package pgstac

import (
	"encoding/json"
	"testing"
)

func TestAssetJSONIncludesExtensionFields(t *testing.T) {
	maxZoom := 19
	asset := Asset{
		Href:     "https://example.test/item.pmtiles",
		Type:     "application/vnd.pmtiles",
		Roles:    []string{"tiles"},
		Title:    "PMTILES archive",
		FileSize: 987654,
		ProjCode: 3857,
		MinZoom:  intPtr(0),
		MaxZoom:  &maxZoom,
	}

	b, err := json.Marshal(asset)
	if err != nil {
		t.Fatalf("Marshal() error = %v", err)
	}

	var got map[string]any
	if err := json.Unmarshal(b, &got); err != nil {
		t.Fatalf("Unmarshal() error = %v", err)
	}

	if _, ok := got["file:size"]; !ok {
		t.Fatalf("JSON missing file:size: %s", string(b))
	}
	if _, ok := got["proj:code"]; !ok {
		t.Fatalf("JSON missing proj:code: %s", string(b))
	}
	if _, ok := got["minzoom"]; !ok {
		t.Fatalf("JSON missing minzoom: %s", string(b))
	}
	if _, ok := got["maxzoom"]; !ok {
		t.Fatalf("JSON missing maxzoom: %s", string(b))
	}
}

func TestAssetJSONOmitsZeroValueExtensionFields(t *testing.T) {
	asset := Asset{Href: "https://example.test/item.pmtiles"}

	b, err := json.Marshal(asset)
	if err != nil {
		t.Fatalf("Marshal() error = %v", err)
	}

	var got map[string]any
	if err := json.Unmarshal(b, &got); err != nil {
		t.Fatalf("Unmarshal() error = %v", err)
	}

	if _, ok := got["file:size"]; ok {
		t.Fatalf("JSON unexpectedly included file:size: %s", string(b))
	}
	if _, ok := got["proj:code"]; ok {
		t.Fatalf("JSON unexpectedly included proj:code: %s", string(b))
	}
	if _, ok := got["minzoom"]; ok {
		t.Fatalf("JSON unexpectedly included minzoom: %s", string(b))
	}
	if _, ok := got["maxzoom"]; ok {
		t.Fatalf("JSON unexpectedly included maxzoom: %s", string(b))
	}
}

func intPtr(v int) *int { return &v }
