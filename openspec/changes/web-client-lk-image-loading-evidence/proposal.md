## Why

LK builds without a background currently import image processing dependencies before a no-op. Load them only for the requested feature and record bundle measurements without claiming unmeasured browser or hardware performance.

## What Changes

- Skip the dynamic image module import when no background is supplied.
- Preserve background output bytes, error identity and caller input ownership.
- Add behavioral loading and real image integration regression tests.
- Document production raw/gzip bundle evidence and measurement limits.

## Capabilities

### New Capabilities

- `lk-background-demand-loading`: Feature-dependent image loading with compatible build behavior.

### Modified Capabilities

None.

## Impact

`web-client/src/services/lk/romBuilder.ts`, focused LK tests and performance evidence documentation. No dependency, UI preload, protocol or native changes.
