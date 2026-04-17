## ADDED Requirements

### Requirement: PPBDeviceOps Interface

A `PPBDeviceOps` interface SHALL be defined to abstract the platform-specific device operations used in PPB unlock flows.

#### Scenario: PPBDeviceOps for GBA

WHEN GBA PPBDeviceOps is provided
THEN `write()` SHALL delegate to `rom_write()` (or its unified equivalent)
AND `read()` SHALL delegate to `rom_read()`
AND `toSectorAddress()` SHALL compute GBA linear sector addresses

#### Scenario: PPBDeviceOps for MBC5

WHEN MBC5 PPBDeviceOps is provided
THEN `write()` SHALL delegate to `gbc_write()` (or its unified equivalent)
AND `read()` SHALL delegate to `gbc_read()`
AND `toSectorAddress()` SHALL compute MBC5 bank-based sector addresses

### Requirement: ppbUnlockCore Shared Implementation

A `ppbUnlockCore(device, ops, sectorCount, onProgress, signal)` function SHALL implement the common PPB unlock algorithm.

#### Scenario: PPB unlock flow

WHEN `ppbUnlockCore()` is invoked
THEN it SHALL:
  1. Read current PPB lock status for each sector
  2. Attempt global PPB unlock command
  3. Verify unlock success by re-reading PPB status
  4. Report progress via the `onProgress` callback
AND the device communication sequence SHALL be byte-identical to the pre-refactor platform-specific implementations

#### Scenario: Abort support

WHEN the `signal` is aborted during PPB unlock
THEN `ppbUnlockCore()` SHALL stop execution at the next safe checkpoint
AND return the partial result

### Requirement: PPB Wrapper Compatibility

`ppbUnlockGBA()` and `ppbUnlockMBC5()` SHALL be preserved as thin wrappers that provide platform-specific `PPBDeviceOps`.

#### Scenario: GBA PPB unlock delegation

WHEN `ppbUnlockGBA(device, ...)` is invoked
THEN it SHALL create a GBA-specific `PPBDeviceOps` and delegate to `ppbUnlockCore()`
AND return the same result as the pre-refactor implementation

#### Scenario: MBC5 PPB unlock delegation

WHEN `ppbUnlockMBC5(device, ...)` is invoked
THEN it SHALL create a MBC5-specific `PPBDeviceOps` and delegate to `ppbUnlockCore()`
AND return the same result as the pre-refactor implementation

#### Scenario: PPB unlock code reduction

WHEN both PPB unlock functions are refactored
THEN the combined line count of `ppbUnlockGBA` + `ppbUnlockMBC5` + `ppbUnlockCore` SHALL be at least 40% less than the pre-refactor combined line count
