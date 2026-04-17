// Package pgstac is a minimal write client for the pgstac schema.
//
// It deliberately only talks through pgstac's public PL/pgSQL
// functions (get_item, update_item) rather than touching the
// partitioned `items` table directly. Those functions are the
// stable, supported write surface - the physical table layout
// changes across pgstac versions but the function signatures do not.
package pgstac

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Client struct {
	pool *pgxpool.Pool
}

func New(ctx context.Context, dsn string) (*Client, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("pgstac connect: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("pgstac ping: %w", err)
	}
	return &Client{pool: pool}, nil
}

func (c *Client) Close() { c.pool.Close() }

// Asset is the subset of STAC asset fields this service writes.
type Asset struct {
	Href     string   `json:"href"`
	Type     string   `json:"type,omitempty"`
	Roles    []string `json:"roles,omitempty"`
	Title    string   `json:"title,omitempty"`
	FileSize int64    `json:"file:size,omitempty"`
	ProjCode int      `json:"proj:code,omitempty"`
	MinZoom  *int     `json:"minzoom,omitempty"`
	MaxZoom  *int     `json:"maxzoom,omitempty"`
}

// AddAsset reads the current STAC item via pgstac.get_item, merges
// the given asset into its `assets` map under assetKey, and writes
// it back via pgstac.update_item. The read+write runs in a
// serializable transaction so two concurrent asset additions for
// the same item cannot clobber each other.
//
// Serializable transactions can fail with Postgres error 40001
// ("could not serialize access"); we retry those up to 3 times with
// short backoffs before giving up.
func (c *Client) AddAsset(ctx context.Context, itemID, collection, assetKey string, asset Asset) error {
	const maxAttempts = 3
	var lastErr error
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		err := c.addAssetOnce(ctx, itemID, collection, assetKey, asset)
		if err == nil {
			return nil
		}
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "40001" {
			lastErr = err
			log.Printf("pgstac serialization retry: item_id=%s collection=%s asset_key=%s attempt=%d/%d", itemID, collection, assetKey, attempt, maxAttempts)
			time.Sleep(time.Duration(attempt*50) * time.Millisecond)
			continue
		}
		return err
	}
	log.Printf("pgstac serialization failure: item_id=%s collection=%s asset_key=%s attempts=%d err=%v", itemID, collection, assetKey, maxAttempts, lastErr)
	return fmt.Errorf("pgstac.update_item: serialization failure after %d attempts: %w", maxAttempts, lastErr)
}

func (c *Client) addAssetOnce(ctx context.Context, itemID, collection, assetKey string, asset Asset) error {
	tx, err := c.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.Serializable})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// pgstac.get_item returns jsonb - pgx scans jsonb into []byte
	// directly, no ::text cast needed.
	var raw []byte
	err = tx.QueryRow(
		ctx,
		`SELECT pgstac.get_item($1, $2)`,
		itemID, collection,
	).Scan(&raw)
	if err != nil {
		return fmt.Errorf("pgstac.get_item: %w", err)
	}
	if len(raw) == 0 || string(raw) == "null" {
		return fmt.Errorf("item %q not found in collection %q", itemID, collection)
	}

	var item map[string]any
	if err := json.Unmarshal(raw, &item); err != nil {
		return fmt.Errorf("decode item: %w", err)
	}
	assets, _ := item["assets"].(map[string]any)
	if assets == nil {
		assets = map[string]any{}
	}
	assetJSON, err := json.Marshal(asset)
	if err != nil {
		return err
	}
	var assetMap map[string]any
	_ = json.Unmarshal(assetJSON, &assetMap)
	assets[assetKey] = assetMap
	item["assets"] = assets

	updated, err := json.Marshal(item)
	if err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `SELECT pgstac.update_item($1::jsonb)`, updated); err != nil {
		return fmt.Errorf("pgstac.update_item: %w", err)
	}
	return tx.Commit(ctx)
}
