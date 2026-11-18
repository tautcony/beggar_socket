# Spec Delta

## ADDED Requirements

### Requirement: Recovery replay from physical sector within write range
The system SHALL, after a program failure, re-erase the physical sector at its true `sector.address`, resume programming from `max(sector.address, baseAddress)`, replay using the same padded image and erased-chunk skip rule as the original write, and return failure once the per-sector retry budget is exhausted.

#### Scenario: Replay in a partially covered first sector
- **WHEN** a write starts at `0x8000` inside a 64 KiB sector at `0x0000` and programming fails in that sector
- **THEN** the sector at `0x0000` is re-erased and programming resumes at `0x8000`, not at a negative offset

#### Scenario: Stateful mock verifies stored bytes after recovery
- **WHEN** a program request mutates simulated flash and then times out or loses its ACK
- **THEN** after recovery the simulated flash in the target range equals the expected image byte-for-byte

#### Scenario: Retries exhausted
- **WHEN** every attempt for a sector fails
- **THEN** `writeROM` returns a failure result naming the sector address
