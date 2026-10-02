## Why

CartBurner currently prepares command data and resets the device inside Vue handlers, and projects late results directly into UI state. Existing application use cases and device ownership can provide these boundaries consistently.

## What Changes

- Move ROM padding, blank buffers, parsed selections and immutable command snapshots into the existing burner application boundary.
- Move command cleanup to an application transaction helper while preserving compatibility exports and public facade signatures.
- Project command results through admitted, identity-guarded flow callbacks; preserve export naming, messages, progress and cancellation behavior.

## Capabilities

### New Capabilities

- `ui-command-orchestration`: Prepared cartridge commands, awaited cleanup and guarded presentation projection.

### Modified Capabilities

None.

## Impact

CartBurner, its session composable, burner application facade and focused tests. No protocol, adapter, firmware, dependency or file-import changes.
