# OpenAerialMap Global Mosaic

On a 12hr schedule:

- Generates global mosaic in PMTiles format, serving via S3.
- Also server TMS via a lightweight Martin server, for clients that
  don't support PMTiles.

## Getting Started

This project uses [uv](https://docs.astral.sh/uv/getting-started/installation/)
to manage Python dependencies.

Once `uv` is installed, you can install the dependencies by,

```bash
uv sync --all-groups
```

## Note On Various Scripts

The `scripts/` directory has five generators developed iteratively. Only
`gen_density_vector.py` is currently in use - see
[`scripts/README.md`](scripts/README.md) for the full iteration history
(what each attempt did and why it was retired).

The Dockerfile bundles and runs `gen_density_vector.py`. It emits a
single `density` layer of grid squares with per-cell image counts at
zooms 0-13. Above z13 the global-tms hands off to TiTiler for real
imagery (see `backend/global-tms`).

## Note On S3 Permissions

- There is an IAM policy `oam-bucket-upload` with permission to upload
  to the `oin-hotosm-temp` bucket.
  - We must ensure this policy also has `"s3:PutObjectAcl"` set, to allow
    setting the global-mosaic.pmtiles file permission to public.
- We have a user `hotosm-oam-global-mosaic-upload` that assigned this
  IAM policy, plus access/secret key for uploading to the bucket.

> [!NOTE]
> There are no doubt better ways to do this from EKS, but using key/secret
> pairs for access is pretty simple and transferable amongst providers,
> rather than being AWS specific.

## Development Testing

- See [doc for loading prod pgSTAC into development](../../docs/backup-prod-pgstac.md)
- Add a `.env` to this directory, with content:

  ```dotenv
  S3_ACCESS_KEY=KEY_FOR_OAM_BUCKET
  S3_SECRET_KEY=SECRET_FOR_OAM_BUCKET/zyalRchM+7
  ```

- Run the script:

  ```bash
  docker compose run --rm mosaicker
  ```
