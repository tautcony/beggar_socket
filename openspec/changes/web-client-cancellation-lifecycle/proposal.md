## Why

Cancellation and timeout currently release the busy flag before the worker and cleanup settle. A second operation can then overlap device activity, and an older finally can release the newer operation.

## What Changes

- Retain token-scoped ownership through execution, cancellation, timeout, and cleanup.
- Reject busy reentry before mutating progress or modal state.
- Keep the existing cancellation presentation and normal result/log/progress contracts.

## Capabilities

### New Capabilities
- `burner-operation-ownership`: Exclusive session ownership until worker and cleanup settle.

### Modified Capabilities

None.

## Impact

Burner application session/flow types and port, session composable, CartBurner reset, and focused unit tests. No dependencies or transport changes.
