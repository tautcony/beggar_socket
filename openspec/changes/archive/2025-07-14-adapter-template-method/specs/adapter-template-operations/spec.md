## ADDED Requirements

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
