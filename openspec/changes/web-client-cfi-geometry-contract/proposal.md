## Why

CFI geometry currently truncates erase regions to four and exposes unchecked exponent and region totals to erase/write consumers. Datasheet-backed fixtures are needed to distinguish supported encodings from malformed responses before enforcing geometry bounds.

## What Changes

- Validate safe device/buffer sizes and complete erase descriptors before returning writable geometry.
- Parse every declared region, preserve 128-byte zero-size encoding and existing D0/D1 correction and boot ordering.
- Add manufacturer datasheet geometry fixtures and boundary regression tests.

## Capabilities

### New Capabilities

- `cfi-geometry-contract`: Complete, safe CFI geometry and compatibility evidence.

### Modified Capabilities

None.

## Impact

`web-client/src/utils/parsers/cfi-parser.ts`, focused parser fixtures/tests, and existing adapter/simulator verification. No dependencies or protocol changes.
