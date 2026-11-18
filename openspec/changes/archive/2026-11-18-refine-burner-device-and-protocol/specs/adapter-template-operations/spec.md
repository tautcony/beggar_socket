# Spec Delta

## ADDED Requirements

### Requirement: MBC ROM verification power and read-recovery parity
`MBC5Adapter.verifyROM()` SHALL manage the requested 5V cartridge power lifecycle, stabilize the command channel before reading, and execute chunked reads with retry and bank recovery consistent with ROM read operations.

#### Scenario: MBC verify enables and restores 5V power
- **WHEN** `MBC5Adapter.verifyROM()` is invoked with `enable5V: true` on a firmware profile that supports `cartPowerControl`
- **THEN** the adapter switches cartridge power to 5V before reading and restores default 3.3V power on completion, mismatch failure, read error, or cancellation

#### Scenario: MBC verify rejects unsupported 5V power control
- **WHEN** `MBC5Adapter.verifyROM()` is invoked with `enable5V: true` on a firmware profile where `cartPowerControl` is `false`
- **THEN** the adapter returns a firmware-unsupported failure without issuing power-control or read commands

#### Scenario: MBC verify stabilizes channel and retries failed chunk reads
- **WHEN** `MBC5Adapter.verifyROM()` runs with `romReadRetryCount > 0` and a chunk read fails transiently
- **THEN** the adapter stabilizes the command channel before verification starts, resets the channel and restores the active bank after the transient failure, and retries the chunk read up to the configured retry limit

### Requirement: MBC ROM write page size compliance
`MBC5Adapter.writeROM()` SHALL resolve its programming chunk size from the ROM write page size configuration (`resolveRomPageSize`) rather than the ROM read page size configuration, ensuring real-device programming chunks never exceed 4096 bytes.

#### Scenario: Smaller write page size setting is honored
- **WHEN** `AdvancedSettings.romPageSize` is set to 512 B or 1024 B and `MBC5Adapter.writeROM()` is called without an explicit `options.romPageSize`
- **THEN** programming chunks are bounded by the configured write page size (512 B or 1024 B)

#### Scenario: Large read page size does not inflate real-device write chunks
- **WHEN** `AdvancedSettings.romReadPageSize` is configured to 32 KiB on an STC profile and `MBC5Adapter.writeROM()` is called without an explicit `options.romPageSize`
- **THEN** real-device programming chunks remain bounded by the validated write page size (at most 4096 bytes) while simulated-device magnification remains isolated to the simulated branch

### Requirement: Platform differences preserved in shared read flow
Any unified ROM read or cart-info template across GBA and MBC adapters SHALL preserve platform-specific MBC3/MBC5 bank-0 address mapping, 5V capability pre-checks, `romReadThrottleMs` behavior, and default size parameters.

#### Scenario: MBC3 and MBC5 bank-0 address mapping
- **WHEN** reading bank 0 through the unified MBC read path or `PlatformOps.toRomBank`
- **THEN** MBC3 maps bank 0 to `0x0000` and MBC5 maps bank 0 to `0x4000`

#### Scenario: 5V capability pre-check before tracking and power switch
- **WHEN** `readROM()` or `getCartInfo()` is requested with `enable5V: true` on a firmware profile without `cartPowerControl`
- **THEN** the adapter rejects the operation before emitting start logs, starting performance tracking, or sending `A0` power commands

### Requirement: Removal of unreachable adapter templates and legacy erase paths
The adapter layer SHALL NOT retain unreachable base-class template methods, unused `PlatformOps` fields, or production-unreachable legacy `eraseChip` / `rom_erase_sector_direct` wrapper chains.

#### Scenario: Legacy erase chains are absent from production adapters
- **WHEN** chip erase is requested through the application use case
- **THEN** chip erase executes exclusively through `eraseSectors()` and no dead `eraseChip()` or `rom_erase_sector_direct()` production wrappers remain

