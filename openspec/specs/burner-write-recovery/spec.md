# burner-write-recovery Specification

## Purpose
TBD - created by archiving change web-client-write-erase-retry-recovery. Update Purpose after archive.
## Requirements
### Requirement: Sector-scoped ROM write recovery
The system SHALL recover ROM write failures at sector scope rather than aborting the whole write immediately when the failed sector can be safely re-erased and retried.

#### Scenario: Chunk write fails before sector completes
- **WHEN** a ROM write chunk fails within a target sector and the same write session has already programmed bytes in that sector
- **THEN** the implementation treats the sector as dirty, re-erases that sector, and retries writing again from that sector start instead of continuing from the failed chunk offset

#### Scenario: Failure occurs in a not-yet-programmed sector
- **WHEN** the first chunk of a sector fails before any bytes in that sector are confirmed as written in the current session
- **THEN** the implementation MAY retry the sector after ensuring the sector is erased, but SHALL NOT require already completed sectors to be erased again

#### Scenario: Recovery budget exhausted
- **WHEN** sector recovery retries reach the configured limit
- **THEN** the ROM write fails with a deterministic write-recovery failure outcome that preserves the underlying device/timeout reason

### Requirement: Full-range erase before ROM write
The system SHALL finish erasing the target ROM range before normal programming begins, while still allowing sector-scoped recovery after a later write failure.

#### Scenario: Target range is fully erased before write begins
- **WHEN** a ROM write session is progressing across multiple sectors
- **THEN** the implementation completes ROM sector preparation for the full target range before entering the normal programming loop

#### Scenario: Later write failure does not force full erase restart
- **WHEN** a ROM write fails and recovers while processing sector N
- **THEN** the write flow resumes from sector N recovery rather than re-erasing already prepared sectors or restarting the full range

### Requirement: Erase retry for ROM sector preparation
The system SHALL retry recoverable ROM sector erase failures with a configurable retry budget before surfacing a final error.

#### Scenario: Initial sector erase times out
- **WHEN** a sector erase operation fails because of timeout or transport/runtime error
- **THEN** the implementation retries that same sector erase according to configured ROM erase retry settings before failing the write flow

#### Scenario: Recovery-triggered re-erase fails
- **WHEN** a recovery-triggered sector re-erase fails during write recovery
- **THEN** the implementation applies the same erase retry policy and only aborts the write after the retry budget is exhausted

### Requirement: Configurable ROM write and erase retry policy
The system SHALL expose configurable retry count and retry delay settings for ROM write recovery and ROM sector erase recovery.

#### Scenario: Advanced settings expose ROM write recovery knobs
- **WHEN** advanced settings are rendered for burner tuning
- **THEN** users can inspect and update ROM write retry count and retry delay settings used by write recovery

#### Scenario: Advanced settings expose ROM erase recovery knobs
- **WHEN** advanced settings are rendered for burner tuning
- **THEN** users can inspect and update ROM erase retry count and retry delay settings used by sector erase recovery

### Requirement: Recovery-aware sector progress visibility
The system SHALL expose erase-oriented sector progress states so UI can distinguish sectors that are pending erase, being erased, and already erased during erase flows and recovery-driven re-erase handling, without forcing normal write progress to masquerade as erase progress.

#### Scenario: Sector awaiting erase is visible
- **WHEN** sector progress is initialized for a ROM erase workflow
- **THEN** sectors that still require erase are represented with a pending-erase state rather than a generic pending/completed placeholder

#### Scenario: Active erase is visible
- **WHEN** the workflow is currently erasing a sector, including recovery-triggered re-erase
- **THEN** sector progress reports that sector with an erasing state

#### Scenario: Erased sector is visible
- **WHEN** a sector erase has completed and the sector is ready for write programming
- **THEN** sector progress reports that sector with an erased state before subsequent write progress consumes it

#### Scenario: Normal write flow keeps write-oriented current state
- **WHEN** the workflow is in its normal post-erase ROM programming phase
- **THEN** sector progress MAY continue using the existing write-oriented pending/processing/completed semantics for the active write cursor, and SHALL NOT require an erasing legend unless a recovery erase is actually in progress

