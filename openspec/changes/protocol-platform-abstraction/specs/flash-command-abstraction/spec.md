## ADDED Requirements

### Requirement: FlashCommandSet Interface

A `FlashCommandSet` interface SHALL be defined to encapsulate the platform-specific differences between GBA and GBC flash operations.

#### Scenario: GBA command set configuration

WHEN `GBA_COMMAND_SET` is used
THEN `unlockAddr1` SHALL be `0x555`
AND `unlockAddr2` SHALL be `0x2aa`
AND `dataWidth` SHALL be `2`
AND `encodeByte(0xaa)` SHALL return a 2-byte little-endian representation

#### Scenario: GBC command set configuration

WHEN `GBC_COMMAND_SET` is used
THEN `unlockAddr1` SHALL be `0xaaa`
AND `unlockAddr2` SHALL be `0x555`
AND `dataWidth` SHALL be `1`
AND `encodeByte(0xaa)` SHALL return a single-byte `Uint8Array([0xaa])`

### Requirement: Unified Flash Unlock Sequence

A `flashUnlockSequence(device, cmdSet, command)` function SHALL implement the common flash unlock pattern using the provided `FlashCommandSet`.

#### Scenario: Standard unlock sequence

WHEN `flashUnlockSequence(device, cmdSet, command)` is invoked
THEN it SHALL write `0xaa` encoded via `cmdSet.encodeByte()` to `cmdSet.unlockAddr1`
AND write `0x55` encoded via `cmdSet.encodeByte()` to `cmdSet.unlockAddr2`
AND write `command` encoded via `cmdSet.encodeByte()` to `cmdSet.unlockAddr1`
AND use `cmdSet.write()` for all write operations

### Requirement: Unified Flash Erase Sector

A `flashEraseSector(device, cmdSet, sectorAddr)` function SHALL implement common sector erase using `FlashCommandSet`.

#### Scenario: Sector erase with GBA command set

WHEN `flashEraseSector(device, GBA_COMMAND_SET, sectorAddr)` is invoked
THEN the byte sequence written to the device SHALL be identical to the pre-refactor `rom_erase_sector(device, sectorAddr)` output

#### Scenario: Sector erase with GBC command set

WHEN `flashEraseSector(device, GBC_COMMAND_SET, sectorAddr)` is invoked
THEN the byte sequence written to the device SHALL be identical to the pre-refactor `gbc_rom_erase_sector(device, sectorAddr)` output

### Requirement: Unified Flash Program

A `flashProgram(device, cmdSet, address, data)` function SHALL implement common flash programming using `FlashCommandSet`.

#### Scenario: Flash program byte-level equivalence

WHEN `flashProgram()` is invoked with a given command set and data
THEN it SHALL produce byte-identical device communication as the corresponding pre-refactor platform-specific function

### Requirement: Unified Flash ID Read

A `flashGetId(device, cmdSet)` function SHALL implement common flash chip identification using `FlashCommandSet`.

#### Scenario: Flash ID read equivalence

WHEN `flashGetId(device, GBA_COMMAND_SET)` is invoked
THEN the device communication SHALL be byte-identical to the pre-refactor `rom_get_id(device)` call

### Requirement: Legacy API Backward Compatibility

Existing platform-specific protocol functions SHALL be preserved as deprecated wrapper functions during the transition period.

#### Scenario: Deprecated wrapper delegation

WHEN a deprecated function such as `rom_erase_sector(device, addr)` is called
THEN it SHALL delegate to `flashEraseSector(device, GBA_COMMAND_SET, addr)` internally
AND return the same result

### Requirement: Protocol Entry Point Unification

`protocol-utils.ts` and `protocol-adapter.ts` SHALL be merged into a single protocol entry point.

#### Scenario: Single import path

WHEN upper-layer code imports protocol utilities
THEN all functions previously available from both `protocol-utils.ts` and `protocol-adapter.ts` SHALL be importable from `protocol-utils.ts` alone

#### Scenario: No dangling imports

WHEN the merge is complete
THEN no file in the codebase SHALL import from `protocol-adapter.ts`
