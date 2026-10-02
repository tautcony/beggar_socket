## Why

ROM writes at a nonzero base currently relocate erase regions instead of selecting physical CFI sectors. This can erase the wrong addresses and accept writes past capacity; physical sector selection also exposes a negative retry offset when a write begins inside a sector.

## What Changes

- Select complete physical sectors intersecting the requested half-open byte range.
- Validate geometry, arithmetic, and available capacity before planning.
- Resume partial first-sector recovery at the logical data start.
- Add geometry and adapter transcript regressions while preserving aligned writes.

## Capabilities

### New Capabilities
- `sector-range-planning`: Physical erase-sector selection and bounded logical programming for nonzero ranges.

### Modified Capabilities
- `burner-write-recovery`: Recovery resumes at the intersection of the physical sector and logical write range.

## Impact

`web-client/src/utils/sector-utils.ts`, the minimal GBA/MBC5 ROM retry offsets, and focused tests. No dependencies, firmware, UI, or native changes.
