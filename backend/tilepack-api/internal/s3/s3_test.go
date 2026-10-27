package s3

import "testing"

func TestKeyFromCOGURLKeepsExplicitZeroZoomCustom(t *testing.T) {
	client := &Client{bucket: "bucket"}
	canonical, err := client.KeyFromCOGURL("https://bucket.s3.example/in/scene.tif", "pmtiles", 0, 0, true)
	if err != nil {
		t.Fatal(err)
	}
	custom, err := client.KeyFromCOGURL("https://bucket.s3.example/in/scene.tif", "pmtiles", 0, 0, false)
	if err != nil {
		t.Fatal(err)
	}
	if canonical != "in/scene.pmtiles" {
		t.Fatalf("canonical key = %q", canonical)
	}
	if custom != "in/scene_z0-0.pmtiles" {
		t.Fatalf("custom key = %q", custom)
	}
}
