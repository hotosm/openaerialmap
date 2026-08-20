#!/usr/bin/env python3
"""
Scripted multipart upload against a running uploader-api (stdlib only).

Exercises the full server-side upload path - createmultipart → signedurl → PUT
→ completemultipart - without a browser, so it needs no S3 CORS. Requires the
API running with AUTH_PROVIDER=disabled (the compose default).

Usage:
    python scripts/test-upload.py path/to/image.tif \
        [--api http://localhost:8090] [--title "My dataset"]
"""

import argparse
import json
import os
import sys
import urllib.request

PART_SIZE = 5 * 1024 * 1024  # 5 MiB (S3 multipart minimum, except the last part)


def post(url: str, body: dict) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read() or "{}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("file")
    ap.add_argument("--api", default="http://localhost:8090")
    ap.add_argument("--title", default=None)
    ap.add_argument(
        "--platform",
        default="uav",
        choices=["kite", "balloon", "uav", "aircraft", "satellite"],
    )
    ap.add_argument(
        "--product-type",
        default="visual",
        choices=["visual", "multispectral", "elevation", "sar", "pseudocolor"],
    )
    ap.add_argument("--acquisition-start", default="2020-01-01T00:00:00Z")
    args = ap.parse_args()

    api = args.api.rstrip("/")
    filename = os.path.basename(args.file)
    title = args.title or os.path.splitext(filename)[0]
    size = os.path.getsize(args.file)

    print(f"→ createmultipart ({filename}, {size} bytes, title={title!r})")
    init = post(
        f"{api}/api/v1/s3/createmultipart",
        {
            "filename": filename,
            "title": title,
            "content_type": "image/tiff",
            "size_bytes": size,
            "metadata": {
                "title": title,
                "provider": "test",
                "license": "CC-BY 4.0",
                "platform": args.platform,
                "product_type": args.product_type,
                "acquisition_start": args.acquisition_start,
            },
        },
    )
    key, upload_id = init["key"], init["upload_id"]

    parts = []
    with open(args.file, "rb") as f:
        n = 0
        while chunk := f.read(PART_SIZE):
            n += 1
            url = post(
                f"{api}/api/v1/s3/signedurl",
                {"key": key, "upload_id": upload_id, "part_number": n},
            )["url"]
            put = urllib.request.Request(url, data=chunk, method="PUT")
            with urllib.request.urlopen(put) as r:
                etag = r.headers.get("ETag")
            parts.append({"ETag": etag, "PartNumber": n})
            print(f"  part {n} uploaded (ETag {etag})")

    print("→ completemultipart")
    result = post(
        f"{api}/api/v1/s3/completemultipart",
        {"key": key, "upload_id": upload_id, "parts": parts},
    )
    print(f"✓ done: {json.dumps(result)}")
    # Machine-parseable line so callers (e2e) can assert on the exact upload.
    print(f"UPLOAD_ID={result.get('upload_id', '')}")
    print("Check the uploads list at", f"{api}/  (or GET {api}/uploads)")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()}", file=sys.stderr)
        sys.exit(1)
