# Spec Delta

## Purpose

Defines physical CFI sector selection, a single chunk planner shared by ROM read/write/verify, and write/verify image consistency.

## ADDED Requirements

### Requirement: Physical CFI sector intersection
The system SHALL compute erase sectors by intersecting `[baseAddress, baseAddress + size)` with the physical sectors enumerated from each CFI block's absolute `startAddress`, SHALL erase each intersected physical sector exactly once, and SHALL fail before any erase only when `baseAddress + size` exceeds the device size.

#### Scenario: Non-zero base address spans two physical sectors
- **WHEN** a 64 KiB write starts at `0x8000` on a layout with 64 KiB physical sectors
- **THEN** the erase set is the physical sectors at `0x0000` and `0x10000`

#### Scenario: Boot-sector layout with non-zero base address
- **WHEN** a write starts at a non-zero aligned `baseAddress` on a chip whose CFI regions have different sector sizes
- **THEN** the erase set uses the sector sizes of the regions that actually contain the range, and no physical sector address appears twice

#### Scenario: Range past device end
- **WHEN** `baseAddress + size` is greater than `deviceSize`
- **THEN** the write fails before any erase command is sent

#### Scenario: Partial head or tail sector
- **WHEN** the range covers only part of its first or last physical sector
- **THEN** the whole sector is erased, the write proceeds, and one warning log reports the erased bytes outside the range

### Requirement: Unified chunk planning
The system SHALL size every ROM read, program, and verify request with one planner such that a chunk ends on a page-size boundary, never crosses the current bank window (32 MiB for GBA multi-bank, 16 KiB for GB/MBC), never crosses the current sector end during programming, and starts on a write-buffer page boundary whenever buffered programming is used. Configured page sizes SHALL be normalized down to a power of two.

#### Scenario: Non-power-of-two page size is normalized
- **WHEN** the configured ROM page size is `1000`
- **THEN** the effective page size is `512` and no request payload length is a non-power-of-two except a final tail limited by range end

#### Scenario: GBA read crosses 32 MiB bank boundary
- **WHEN** `readROM` or `verifyROM` covers `[28 MiB, 36 MiB)` on a multi-bank GBA cartridge
- **THEN** no single read request spans the `32 MiB` boundary and the bank is switched before the first request above it

#### Scenario: GB verify crosses 16 KiB window
- **WHEN** `verifyROM` reads across a `0x4000` boundary on an MBC cartridge
- **THEN** no single read request spans the `0x4000` boundary

#### Scenario: Program chunk starts on write-buffer page
- **WHEN** `writeROM` programs with `bufferSize = 512`
- **THEN** every program request address is a multiple of `512`

### Requirement: Same image and range for write and verify
The system SHALL pad input shorter than `size` with `0xFF` inside the adapter, SHALL use the same `baseAddress`, `size`, and padded image for programming and verification, and SHALL advance completion only by bytes actually covered by each chunk.

#### Scenario: Padding region is verified
- **WHEN** a ROM shorter than `size` is written and a byte in the padded region differs on the cartridge
- **THEN** `verifyROM` with the same file, `baseAddress`, and `size` fails at that address

#### Scenario: Short input via direct adapter call
- **WHEN** `writeROM` is called with 4 bytes of data and `size = 8`
- **THEN** 8 bytes are written, the last 4 being `0xFF`, and the reported completion equals 8
