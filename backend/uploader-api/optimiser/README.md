# Browser optimiser

GDAL compiled to WebAssembly with [crossbind](https://crossbind.dev). The
`/optimize` page uses it to shrink large orthophotos in the browser before
upload.

It writes the same visual COG as `pipeline/convert/convert.py`, so the server
skips conversion. If the codec, block size or mask handling changes there,
change `src/native/optimiser.cpp` to match.

## Build

The uploader-api Docker image builds it, so `just start all` is enough. Then
open <http://localhost:8090/optimize>. The first build downloads a 1.2 GB
toolchain image and takes a few minutes. After that Docker caches it.

To build on your machine instead (needs Node 26+, pnpm and Docker):

```sh
cd backend/uploader-api/optimiser
pnpm install
pnpm build   # writes dist/
```

Local compose serves the copy inside the image, not your `dist/`.

## Limits

- Only visual imagery (8-bit RGB or RGBA). Elevation, terrain and multispectral
  files are uploaded as they are.
- The browser needs free disk of about twice the file size. The file is copied
  into browser storage (OPFS) while GDAL works on it.
- The page sends extra security headers (COOP/COEP) that multi-threaded WASM
  needs. Only the optimiser gets them.
