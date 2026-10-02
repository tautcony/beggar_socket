## Why

Native serial commands currently retain the session registry mutex throughout blocking I/O. One slow device can stall unrelated sessions and prevent close from requesting cancellation.

## What Changes

- Isolate each serial port behind its own owner and operation mutex.
- Reject commands after close starts and wait for active I/O and resource disposal before confirming close.
- Observe cancellation between bounded I/O slices while preserving exact reads and total deadlines.
- Require locked native checks and unit tests before desktop packaging.

## Capabilities

### New Capabilities

- `native-session-isolation`: Per-session admission, cancellation, ownership, and native CI gates.

### Modified Capabilities

None.

## Impact

Scoped to native_platform.rs, its Rust unit tests, and the shared quality workflow contract. No transport API or dependency changes. Serial driver calls and flush cannot be forcibly cancelled portably.
