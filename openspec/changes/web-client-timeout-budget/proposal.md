## Why

The operation timeout setting is unused and packet deadlines have different backend meanings. Enabling a fixed operation limit by default would interrupt valid long transfers.

## What Changes

- Add a disabled-by-default operation budget with strict boolean settings validation.
- Cooperatively abort execution at its budget and retain ownership through real completion and cleanup.
- Preserve backend packet timeout semantics and expose stable timeout diagnostics.

## Capabilities

### New Capabilities

- `operation-timeout-budget`: opt-in execution budget and documented packet timeout contracts.

### Modified Capabilities

None.

## Impact

Advanced settings, modal translations, burner flow/composable, serial timeout diagnostics and focused unit tests. No firmware, native driver, or dependency changes.
