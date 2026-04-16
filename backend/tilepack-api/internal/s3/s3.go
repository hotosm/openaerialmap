package s3

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/url"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	smithy "github.com/aws/smithy-go"
)

// Client wraps the few S3 operations the API needs: head a key, write
// a small lock object, and translate keys into public URLs.
type Client struct {
	s3            *s3.Client
	bucket        string
	publicBaseURL string
}

func New(ctx context.Context, bucket, publicBaseURL string) (*Client, error) {
	cfg, err := awsconfig.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, err
	}
	return &Client{
		s3:            s3.NewFromConfig(cfg),
		bucket:        bucket,
		publicBaseURL: strings.TrimRight(publicBaseURL, "/"),
	}, nil
}

// KeyFromCOGURL derives the tilepack output S3 key from the COG URL
// on the STAC item. OAM lays imagery out as
//
//	oin-hotosm-temp/<metadata-id>/0/<id>.tif
//
// and we want the tilepack to sit next to it as
//
//	oin-hotosm-temp/<metadata-id>/0/<id>.{mbtiles|pmtiles}
//
// For custom-zoom variants we append a suffix so they don't collide
// with the canonical archive.
//
// Returns an error if the COG URL doesn't reference the configured
// bucket - we refuse to write into a bucket we weren't given.
func (c *Client) KeyFromCOGURL(cogURL, format string, minZoom, maxZoom int) (string, error) {
	u, err := url.Parse(cogURL)
	if err != nil {
		return "", fmt.Errorf("parse cog url: %w", err)
	}
	key := strings.TrimPrefix(u.Path, "/")
	// Virtual-hosted style: bucket is in the hostname.
	// Path style: first path segment is the bucket.
	if !strings.HasPrefix(u.Host, c.bucket+".") && u.Host != c.bucket {
		// Path-style: strip "<bucket>/" prefix if present.
		if !strings.HasPrefix(key, c.bucket+"/") {
			return "", fmt.Errorf("cog url not in bucket %q: %s", c.bucket, cogURL)
		}
		key = strings.TrimPrefix(key, c.bucket+"/")
	}
	// Swap .tif/.tiff extension for the target format.
	lower := strings.ToLower(key)
	switch {
	case strings.HasSuffix(lower, ".tif"):
		key = key[:len(key)-4]
	case strings.HasSuffix(lower, ".tiff"):
		key = key[:len(key)-5]
	default:
		return "", fmt.Errorf("cog url is not a .tif/.tiff: %s", cogURL)
	}
	if minZoom == 0 && maxZoom == 0 {
		return fmt.Sprintf("%s.%s", key, format), nil
	}
	return fmt.Sprintf("%s_z%d-%d.%s", key, minZoom, maxZoom, format), nil
}

func (c *Client) LockKey(outputKey string) string { return outputKey + ".lock" }

func (c *Client) PublicURL(key string) string {
	return fmt.Sprintf("%s/%s", c.publicBaseURL, key)
}

// HeadObject reports whether the key exists, and (when it does) the
// time it was last modified and object content length. NotFound is
// returned as (false, zero, 0, nil) rather than an error to keep call
// sites simple.
func (c *Client) HeadObject(ctx context.Context, key string) (exists bool, lastModified time.Time, contentLength int64, err error) {
	out, err := c.s3.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		var ae smithy.APIError
		if errors.As(err, &ae) && (ae.ErrorCode() == "NotFound" || ae.ErrorCode() == "NoSuchKey") {
			return false, time.Time{}, 0, nil
		}
		log.Printf("s3 head object failed: bucket=%s key=%s err=%v", c.bucket, key, err)
		return false, time.Time{}, 0, err
	}
	if out.LastModified != nil {
		lastModified = *out.LastModified
	}
	if out.ContentLength != nil {
		contentLength = *out.ContentLength
	}
	return true, lastModified, contentLength, nil
}

// DeleteObject removes a key. Used by the handler to clean up a
// lock object if worker Job creation fails - without this, a
// transient API → apiserver error would block regeneration for
// the full lock TTL.
func (c *Client) DeleteObject(ctx context.Context, key string) error {
	_, err := c.s3.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		log.Printf("s3 delete object failed: bucket=%s key=%s err=%v", c.bucket, key, err)
	}
	return err
}

// PutLock writes a tiny placeholder object that other instances /
// requests use to detect an in-progress generation. Body is empty -
// only existence and LastModified matter.
func (c *Client) PutLock(ctx context.Context, key string) error {
	_, err := c.s3.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(c.bucket),
		Key:         aws.String(key),
		ContentType: aws.String("text/plain"),
		// Body intentionally nil - zero-length object is enough.
		StorageClass: types.StorageClassStandard,
	})
	if err != nil {
		log.Printf("s3 put lock failed: bucket=%s key=%s err=%v", c.bucket, key, err)
	}
	return err
}
