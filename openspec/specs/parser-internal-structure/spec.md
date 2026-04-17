## ADDED Requirements

### Requirement: CFI Parser Method Decomposition

CFIParser.parse() SHALL be decomposed into focused sub-methods, each responsible for a single CFI data region.

#### Scenario: Parse orchestration delegates to sub-methods

WHEN `CFIParser.parse()` is invoked with a valid CFI data buffer
THEN it SHALL sequentially call `parseQueryInfo()`, `parsePrimaryAlgorithm()`, `parseExtendedQuery()`, `parseGeometry()`, and `parseProtectionInfo()`
AND combine their results into the same `CFIInfo` structure as the current implementation

#### Scenario: Sub-method size limit

WHEN any CFI parser sub-method is implemented
THEN it SHALL NOT exceed 80 lines of code

#### Scenario: Sub-method isolation

WHEN a sub-method is invoked
THEN it SHALL receive the data buffer and current offset as parameters
AND it SHALL return its parsed result and the updated offset
AND it SHALL NOT mutate shared class state beyond its return value

### Requirement: CFI Offset Constants

All hardcoded numeric offsets in CFI parsing logic SHALL be replaced with named constants.

#### Scenario: CFI offset constant definitions

WHEN CFI parser constants are defined
THEN they SHALL be organized as a `CFI_OFFSETS` constant object (or equivalent namespace)
AND each constant name SHALL describe the CFI data field it represents (e.g., `QUERY_ID_STRING`, `PRIMARY_ALGORITHM_TABLE`, `ERASE_BLOCK_REGION`)

#### Scenario: No remaining magic numbers in CFI parser

WHEN the CFI parser implementation is complete
THEN no numeric literal offsets SHALL remain in parsing logic except for arithmetic operations on named constants (e.g., `CFI_OFFSETS.BASE + 2`)

### Requirement: ROM Logo Validation Parameterization

`validateGBALogo()` and `validateGBLogo()` SHALL be unified into a parameterized implementation.

#### Scenario: Unified validateLogo function

WHEN `validateLogo(data, expectedLogo, offset)` is invoked
THEN it SHALL compare the data at the given offset against the expected logo bytes
AND return `true` if and only if all bytes match

#### Scenario: Existing API compatibility

WHEN `validateGBALogo(data)` is invoked
THEN it SHALL delegate to the unified `validateLogo()` with GBA-specific logo and offset parameters
AND return the same result as the pre-refactor implementation

WHEN `validateGBLogo(data)` is invoked
THEN it SHALL delegate to the unified `validateLogo()` with GB-specific logo and offset parameters
AND return the same result as the pre-refactor implementation

### Requirement: ROM Checksum Calculation Parameterization

`calculateGBAChecksum()` and `calculateGBChecksum()` SHALL be unified into a parameterized implementation.

#### Scenario: Unified calculateHeaderChecksum function

WHEN `calculateHeaderChecksum(data, range, initial)` is invoked
THEN it SHALL compute the checksum over the specified byte range with the given initial value
AND return the computed checksum

#### Scenario: Existing API compatibility for checksum

WHEN `calculateGBAChecksum(data)` is invoked
THEN it SHALL delegate to `calculateHeaderChecksum()` with GBA-specific range and initial value
AND return the same result as the pre-refactor implementation

WHEN `calculateGBChecksum(data)` is invoked
THEN it SHALL delegate to `calculateHeaderChecksum()` with GB-specific range and initial value
AND return the same result as the pre-refactor implementation

### Requirement: ROM Editor Update Parameterization

`updateGBARom()` and `updateGBRom()` SHALL be unified via a field map pattern.

#### Scenario: Field map driven ROM update

WHEN `updateRomInfo(data, romType, fields)` is invoked
THEN it SHALL select the appropriate `RomFieldMap` for the given ROM type
AND write each field value at the mapped offset
AND recalculate and write the header checksum

#### Scenario: ROM editor API compatibility

WHEN the refactored ROM editor is used
THEN it SHALL produce byte-identical output to the pre-refactor implementation for the same inputs

### Requirement: Color Generation Unification

`generateSlotColor()` and `generateFileColor()` SHALL delegate to a shared `generateHslColor()` function.

#### Scenario: Unified HSL color generation

WHEN `generateHslColor(index, saturation, lightness)` is invoked
THEN it SHALL compute an HSL color string using golden-ratio-based hue distribution
AND return a valid CSS `hsl()` string

#### Scenario: Existing color function compatibility

WHEN `generateSlotColor(index)` or `generateFileColor(index)` is invoked
THEN it SHALL delegate to `generateHslColor()` with the appropriate saturation and lightness parameters
AND return the same color string as the pre-refactor implementation
