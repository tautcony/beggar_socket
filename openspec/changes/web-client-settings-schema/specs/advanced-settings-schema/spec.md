## ADDED Requirements

### Requirement: Runtime schema validation
The settings module SHALL reject malformed roots, groups, unknown fields, nonnumeric and non-finite numeric values. Strict validation and loading SHALL require integer values within existing bounds. Mutation APIs SHALL preserve finite clamping and existing integer truncation except fractional page sizes SHALL be rejected. Unsupported firmware mutation values SHALL retain the existing stm fallback.

#### Scenario: Invalid later field cannot partially update state
- **WHEN** a settings update includes a valid firmware or numeric field and a later malformed field
- **THEN** the update throws before changing memory or persistence

#### Scenario: Invalid JSON values are rejected
- **WHEN** persisted settings contain null, arrays, strings, object numeric fields, fractions, or values outside bounds
- **THEN** the module restores in-memory defaults and preserves the original stored snapshot

### Requirement: Versioned compatible persistence
The module SHALL save root version 1 under advanced_settings. It SHALL accept valid unversioned snapshots without rewriting explicit page sizes, accept version 1, and preserve snapshots with unsupported versions while restoring in-memory defaults. Storage failures SHALL be caught.

#### Scenario: Explicit old page sizes roundtrip
- **WHEN** an unversioned snapshot contains ROM 512 and RAM 256 byte page sizes
- **THEN** those values load unchanged and subsequent saves retain them with version 1

#### Scenario: Unknown future version is preserved
- **WHEN** a snapshot has an unsupported version
- **THEN** defaults are used in memory and the stored snapshot remains unchanged
