# Lossy WEBP COGs for visual imagery

## Context

Lossless ZSTD can expand an already JPEG-compressed ortho by 10x. The uploaded
file is retained as the unmodified `original`, while the COG is the serving
copy.

## Decision

Write visual uint8 RGB(A) as WEBP quality 90; keep other products lossless
ZSTD-12. Preserve transparency as alpha and verify georeferencing, the validity
mask, sampled pixel error, and COG layout. `COG_VISUAL_COMPRESS=JPEG` selects
JPEG; `off` restores lossless conversion.

Record the lossy codec in lineage and the visual asset title. Existing items
are not converted again.

## Consequences

Visual COGs are smaller but may contain second-generation loss. The `original`
asset remains byte-identical and non-visual products remain lossless.
