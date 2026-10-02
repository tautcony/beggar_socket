## Why

LK preparation can overwrite status bytes through save slot zero and allocation can accept a truncated logical ROM span. Configuration boundaries need explicit checks before producing unsafe menu images.

## What Changes

- Validate cartridge geometry and fixed menu/list/status reservations.
- Preserve no-save slot zero, validate one-based save slots, reserve them independently of imported files, and initialize shared slots once.
- Require the complete logical ROM allocation to fit and bound item-list serialization to its reserved sector.
- Add small-memory boundary fixtures and preserve valid golden bytes.

## Capabilities

### New Capabilities
- `lk-capacity-layout`: Safe capacity and metadata boundaries for LK builds.

### Modified Capabilities

None.

## Impact

LK romBuilder validation, focused tests, and this change's artifacts. No dependencies, UI, native, or image-processing changes.
