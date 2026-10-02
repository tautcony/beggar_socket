## MODIFIED Requirements

### Requirement: Sector-scoped ROM write recovery
The system SHALL recover ROM write failures at sector scope rather than aborting the whole write immediately when the failed sector can be safely re-erased and retried.

#### Scenario: Chunk write fails before sector completes
- **WHEN** a ROM write chunk fails within a target sector and the same write session has already programmed bytes in that sector
- **THEN** the implementation treats the sector as dirty, re-erases that sector, and retries writing again from the later of that physical sector start and the logical write base instead of continuing from the failed chunk offset

#### Scenario: Failure occurs in a not-yet-programmed sector
- **WHEN** the first chunk of a sector fails before any bytes in that sector are confirmed as written in the current session
- **THEN** the implementation MAY retry the sector after ensuring the sector is erased, but SHALL NOT require already completed sectors to be erased again

#### Scenario: Recovery budget exhausted
- **WHEN** sector recovery retries reach the configured limit
- **THEN** the ROM write fails with a deterministic write-recovery failure outcome that preserves the underlying device/timeout reason

#### Scenario: First partial sector recovery
- **WHEN** a program chunk fails in the first physical sector and the logical write starts inside it
- **THEN** recovery re-erases the physical sector and restarts at logical offset zero without programming before the base or beyond the requested end
