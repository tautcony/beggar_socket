# adapter-template-operations Specification

## Purpose
Defines the `PlatformOps` interface and `CartridgeAdapter` template-method architecture for cartridge operations.

## Requirements

### Requirement: PlatformOps Interface

A `PlatformOps` interface SHALL be defined to encapsulate all adapter-level platform differences between GBA and GBC/MBC5.

#### Scenario: GBA PlatformOps implementation

WHEN `GBA_PLATFORM_OPS` is used
THEN `platform` SHALL be `'gba'`
AND `romBankSize` SHALL reflect GBA's linear addressing (no bank switching)
AND `switchRomBank()` SHALL be a no-op
AND `flashCommandSet` SHALL reference `GBA_COMMAND_SET` from the protocol layer

#### Scenario: MBC5 PlatformOps implementation

WHEN `MBC5_PLATFORM_OPS` is used
THEN `platform` SHALL be `'gbc'`
AND `romBankSize` SHALL be `0x4000`
AND `switchRomBank()` SHALL execute the MBC5 bank register write sequence
AND `flashCommandSet` SHALL reference `GBC_COMMAND_SET` from the protocol layer

### Requirement: CartridgeAdapter Template Methods

`CartridgeAdapter` base class SHALL implement template methods for ROM and RAM operations that delegate platform-specific steps to `PlatformOps`.

#### Scenario: readROM template method

WHEN `readROM()` is invoked on any adapter subclass
THEN the base class template method SHALL:
  1. Initialize progress context via `createProgressContext()`
  2. Iterate over address chunks, calling `platformOps.switchRomBank()` and `platformOps.flashCommandSet.read()` for each
  3. Report progress after each chunk
AND the byte-level device communication SHALL be identical to the pre-refactor platform-specific implementation

#### Scenario: writeROM template method

WHEN `writeROM()` is invoked on any adapter subclass
THEN the base class template method SHALL:
  1. Initialize progress context
  2. Sample blank regions via the shared `sampleRomRegionBlank()` method
  3. Erase sectors via the shared `eraseSectors()` method
  4. Iterate over data chunks, calling bank switch and flash program for each
  5. Optionally verify via the shared `verifyROM()` method
AND the byte-level device communication SHALL be identical to the pre-refactor implementation

#### Scenario: verifyROM template method

WHEN `verifyROM()` is invoked on any adapter subclass
THEN the base class template method SHALL read back ROM data and compare with the expected data
AND the verification logic SHALL be identical to the pre-refactor implementation

#### Scenario: eraseSectors template method

WHEN `eraseSectors()` is invoked on any adapter subclass
THEN the base class template method SHALL iterate over sector addresses, calling `platformOps.flashCommandSet` erase operations
AND support retry logic identical to the pre-refactor implementation

#### Scenario: RAM operation template methods

WHEN `readRAM()`, `writeRAM()`, or `verifyRAM()` is invoked on any adapter subclass
THEN the base class template method SHALL handle RAM bank switching via `platformOps.switchRamBank()`, `enableRam()`, and `disableRam()`
AND the byte-level behavior SHALL be identical to the pre-refactor implementation

### Requirement: Subclass Minimality

GBAAdapter and MBC5Adapter subclasses SHALL contain only platform-specific configuration, not duplicated operation logic.

#### Scenario: GBAAdapter size constraint

WHEN GBAAdapter is refactored
THEN it SHALL NOT exceed 350 lines of code
AND it SHALL primarily consist of `createPlatformOps()` implementation and platform-unique operations

#### Scenario: MBC5Adapter size constraint

WHEN MBC5Adapter is refactored
THEN it SHALL NOT exceed 350 lines of code
AND it SHALL primarily consist of `createPlatformOps()` implementation and platform-unique operations

### Requirement: Progress Context Factory

A `createProgressContext()` factory method SHALL be provided in the base class to eliminate repeated SpeedCalculator + ProgressReporter initialization.

#### Scenario: Progress context creation

WHEN `createProgressContext({ operation, totalBytes, sectors })` is invoked
THEN it SHALL return a configured `SpeedCalculator` and `ProgressReporter` pair
AND the reporter SHALL be initialized with the provided sectors if given

#### Scenario: Elimination of initialization duplication

WHEN all adapter operations use `createProgressContext()`
THEN no operation method SHALL contain inline SpeedCalculator/ProgressReporter construction

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
