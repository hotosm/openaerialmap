package stac

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Client is a tiny STAC API client. It only implements the operations
// the tilepack API needs: fetch a single item from a fixed collection.
type Client struct {
	BaseURL    string
	Collection string
	HTTP       *http.Client
}

func New(baseURL, collection string) *Client {
	return &Client{
		BaseURL:    baseURL,
		Collection: collection,
		HTTP:       &http.Client{Timeout: 15 * time.Second},
	}
}

// Item is a partial STAC item - only the fields the handler needs.
type Item struct {
	ID         string               `json:"id"`
	Collection string               `json:"collection"`
	BBox       []float64            `json:"bbox"`
	Properties map[string]any       `json:"properties"`
	Assets     map[string]ItemAsset `json:"assets"`
	Links      []map[string]any     `json:"links"`
	Extra      map[string]any       `json:"-"`
}

type ItemAsset struct {
	Href     string   `json:"href"`
	Type     string   `json:"type,omitempty"`
	Roles    []string `json:"roles,omitempty"`
	Title    string   `json:"title,omitempty"`
	FileSize int64    `json:"file:size,omitempty"`
	ProjCode int      `json:"proj:code,omitempty"`
}

// ErrNotFound indicates the item does not exist in the configured collection.
type ErrNotFound struct{ ID string }

func (e *ErrNotFound) Error() string { return fmt.Sprintf("item %q not found", e.ID) }

// GetItem fetches a single item from the configured collection. Items
// in any other collection are reported as not-found to keep the
// surface area minimal: callers cannot enumerate other collections.
func (c *Client) GetItem(ctx context.Context, id string) (*Item, error) {
	url := fmt.Sprintf("%s/collections/%s/items/%s", c.BaseURL, c.Collection, id)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return nil, &ErrNotFound{ID: id}
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("stac get item: status %d", resp.StatusCode)
	}
	var item Item
	if err := json.NewDecoder(resp.Body).Decode(&item); err != nil {
		return nil, fmt.Errorf("decode stac item: %w", err)
	}
	if item.Collection != "" && item.Collection != c.Collection {
		return nil, &ErrNotFound{ID: id}
	}
	return &item, nil
}

// cogMediaType is the exact content type OAM uses for its COG assets.
// Verified against https://api.imagery.hotosm.org/stac on 2026-04-08.
const cogMediaType = "image/tiff; application=geotiff; profile=cloud-optimized"

// PrimaryCOGAsset returns the href of the OAM item's COG.
//
// OAM items always expose the COG under the `visual` asset key with
// the cloud-optimized GeoTIFF media type. We intentionally do NOT
// fall back to "any geotiff-like asset" - if the item doesn't match
// this shape the API returns 422 rather than silently picking the
// wrong asset.
func PrimaryCOGAsset(item *Item) (string, bool) {
	a, ok := item.Assets["visual"]
	if !ok || a.Href == "" || a.Type != cogMediaType {
		return "", false
	}
	return a.Href, true
}

// GSD returns the ground sample distance (metres/pixel) from the item
// properties. This is used to derive a sensible default max zoom
// without having to open the COG. Returns (0, false) if absent or
// malformed.
func GSD(item *Item) (float64, bool) {
	if item.Properties == nil {
		return 0, false
	}
	v, ok := item.Properties["gsd"]
	if !ok {
		return 0, false
	}
	switch n := v.(type) {
	case float64:
		if n > 0 {
			return n, true
		}
	case int:
		if n > 0 {
			return float64(n), true
		}
	}
	return 0, false
}

// HasTilepackAsset reports whether the item already has a tilepack
// asset for the given format. Used by the handler to short-circuit
// duplicate work.
func HasTilepackAsset(item *Item, format string) (string, bool) {
	key := assetKeyForFormat(format)
	if a, ok := item.Assets[key]; ok && a.Href != "" {
		return a.Href, true
	}
	return "", false
}

func assetKeyForFormat(format string) string {
	return format
}
