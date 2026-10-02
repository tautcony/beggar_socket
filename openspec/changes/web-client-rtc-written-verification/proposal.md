## Why

RTC setTime currently logs readback without comparing it to the requested time, so ignored writes can resolve successfully. Make success depend on a valid matching hardware snapshot while retaining failure cleanup.

## What Changes

- Compare typed requested snapshots with bounded readback attempts and monotonic elapsed seconds.
- Validate GBA BCD/status and MBC3 Halt/carry, with hardware calendar/counter rollover rules.
- Preserve GPIO/RAM session cleanup and original MBC3 control restoration after verification failures.
- Remove unused log-only verification paths; add fault and ticking clock regression tests.

## Capabilities

### New Capabilities

- `rtc-written-verification`: Observable write verification with elapsed-time tolerance and deterministic cleanup.

### Modified Capabilities

None.

## Impact

Only RTC services and focused RTC tests. Public setTime and readTime shapes remain unchanged. No dependencies or firmware changes; validation uses protocol models, not hardware.
