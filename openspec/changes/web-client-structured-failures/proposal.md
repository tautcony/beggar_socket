## Why

Services discard protocol error metadata when returning translated messages, preventing reliable diagnosis at the application boundary (AD-D02).

## What Changes

- Extend CommandResult with optional structured failures and preserve original causes through services, ports, use cases and UI diagnostics.
- Keep healthy results, protocol frames and legacy message-only failures compatible.

## Capabilities

### New Capabilities

- `structured-command-failures`: Preserve structured command failures across burner boundaries.

### Modified Capabilities

None.

## Impact

CommandResult, burner error mapping and port/use case, cartridge services and existing logging integration. No dependencies or protocol changes.
