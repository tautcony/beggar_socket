## Why

GBA and MBC adapters bypass the base ROM read and cartridge-info templates, leaving divergent read loops and unused PlatformOps configuration. Batch 4 / AD-D01 requires an actual shared execution path with evidence that hardware command, progress, retry and cancellation behavior remains compatible.

## What Changes

- Route public GBA/MBC ROM reads through one shared read loop with explicit bank-window, bank switching, power and throttle strategies.
- Keep the existing atomic ROM read retry entry point used by reads, GBA verification and write blank sampling.
- Remove unused base read/info templates and unused concrete PlatformOps configuration; retain a deprecated legacy PlatformOps type export for source compatibility.
- Add deterministic command/progress transcript tests before migration; retain existing verification and hardware-specific info flows.

## Capabilities

### New Capabilities

- `adapter-shared-rom-read`: One exercised ROM read execution rule preserving platform policies and public result contracts.

### Modified Capabilities

- `adapter-template-operations`: Replace unexercised all-operation templates and line-count goals with exercised ROM read/retry rules and explicit hardware policies.

## Impact

Scoped to cartridge-adapter, gba-adapter, mbc5-adapter, platform-ops and focused adapter tests. No protocol, dependency, write/erase, application/composable, RTC, LK or firmware changes. CartridgeAdapter public entries and CommandResult contracts remain available.
