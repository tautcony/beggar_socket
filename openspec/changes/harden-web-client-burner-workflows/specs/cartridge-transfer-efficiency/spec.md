# Spec Delta

## Purpose

Defines client-side measures that remove transfer overhead on existing firmware protocols, and the measurements used to judge them.

## ADDED Requirements

### Requirement: Skip erased-state program chunks
After a sector has been erased in the current write (initial erase or recovery re-erase), the system SHALL NOT send a program request for a planned chunk whose bytes are all `0xFF`, SHALL count that chunk as completed, and SHALL report the skipped byte total. Verification SHALL still read skipped ranges.

#### Scenario: Padded image sends fewer program requests
- **WHEN** a 6 MiB ROM is written with `size = 8 MiB`
- **THEN** no program request is sent for the trailing 2 MiB of `0xFF`, the write completes at 8 MiB, and the summary reports 2 MiB skipped

#### Scenario: Skipped range is still verified
- **WHEN** a skipped range reads back with a non-`0xFF` byte
- **THEN** verification fails at that address

### Requirement: Firmware-aware ROM read chunk size
The system SHALL size ROM read and verify requests by `min(romReadPageSize, profile.maxReadChunk)`, where `maxReadChunk` is 4 KiB for `stm` and `unknown` profiles and 32 KiB for the `stc` profile, independent of the write page size and subject to the unified chunk planner. The default `romReadPageSize` SHALL equal the default ROM page size.

#### Scenario: STM profile cap
- **WHEN** `romReadPageSize` is 32 KiB and the profile is `stm`
- **THEN** no ROM read request exceeds 4 KiB

#### Scenario: STC profile larger reads on GBA
- **WHEN** `romReadPageSize` is 32 KiB, the profile is `stc`, and a GBA ROM is read from an aligned address
- **THEN** read requests are 32 KiB except where the planner clamps at bank or range end

### Requirement: Transfer timing summary
The system SHALL report, for each ROM write, erase time, transfer time, total time, program request count, retry count, and skipped bytes, and for each read/verify, request count and effective throughput computed from bytes in the target range only.

#### Scenario: Replayed bytes excluded from effective throughput
- **WHEN** a sector is replayed once during a write
- **THEN** the retry count is 1 and effective throughput uses the target range size, not target size plus replayed bytes
