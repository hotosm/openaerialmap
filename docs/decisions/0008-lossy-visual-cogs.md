# Lossy JPEG COGs for visual imagery

## Context

Lossless ZSTD can expand an already JPEG-compressed ortho by 10x. The uploaded
file is retained as the unmodified `original`, while the COG is the serving
copy.

WEBP q90 is 10-20% smaller than JPEG q90, but several GDAL builds cannot
read WEBP-in-TIFF, including QGIS on macOS (#342). Legacy OAM, Maxar, NOAA,
and Vantor already use YCbCr JPEG (#337).

## Decision

Write visual uint8 RGB(A) as YCbCr JPEG quality 90; keep other products
lossless ZSTD-12. Transparency becomes a per-dataset mask band. Verify
georeferencing, the validity mask, sampled pixel error, and COG layout.

Fix codec and quality in code to match validate's measured disk allowance.
Higher quality needs more space; convert-only settings would be invisible to
validate.

Budget 0.9x decoded size for lossy output and 1.5x for lossless. JPEG q90
peaked at 0.72-0.83x in measurements (#365). Keep GDAL's overview temp lossless
ZSTD: lossy temp files halve peak disk use but reduce overview quality to
36 dB at q90.

Record the lossy codec in lineage and the visual asset title. Existing items
are not converted again.

## Consequences

Visual COGs are smaller and avoid WEBP compatibility issues, but recompression
can reduce quality. Readers that ignore mask bands (geotiff.js) show black
collars. Originals stay byte-identical; non-visual products stay lossless.
