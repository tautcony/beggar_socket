## Why

RTC setters accept unknown runtime data that can currently reach device I/O before validation or silently coerce malformed values. Rejecting invalid data before hardware work prevents unintended cartridge state changes.

## What Changes

- Validate finite integer fields, shape, calendar bounds and ordinal bounds before any device operation.
- Copy validated inputs before awaiting device work.
- Reject invalid DateTime inputs and preserve existing GBA weekday and MBC3 current-year ordinal semantics.
- Add hardware-free contract tests.

## Capabilities

### New Capabilities

- `rtc-input-contract`: Pure RTC input validation and stable write snapshots.

### Modified Capabilities

None.

## Impact

Only RTC base/GBA/MBC3 services and focused tests. No dependency, recovery or readback-verification changes.
