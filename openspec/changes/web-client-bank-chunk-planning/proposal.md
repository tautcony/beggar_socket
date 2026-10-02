## Why

Non-aligned ROM and RAM transfers can cross cartridge bank windows within one command, returning or programming bytes in the wrong bank. GBA RAM also selects banks using transferred offsets rather than logical addresses.

## What Changes

- Introduce pure bank-window chunk planning with explicit MBC mapping and GBA address units.
- Clamp ROM reads/verifications and RAM reads/writes/verifications to each bank window.
- Select GBA RAM banks from absolute logical addresses.
- Add boundary tests with distinct adjacent-bank contents and retain existing ROM programming behavior.

## Capabilities

### New Capabilities
- `bank-window-chunk-planning`: Correct logical address mapping and bounded cartridge transfers.

### Modified Capabilities

None.

## Impact

GBA and MBC5 adapters, a pure service utility, and adapter/planner tests. No public API, dependency, transport framing or native changes.
