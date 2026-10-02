## ADDED Requirements

### Requirement: Build state is isolated

Every LK build SHALL own its result log and SHALL leave caller settings unchanged.

#### Scenario: Concurrent hashing
- **WHEN** two builds with different game metadata overlap during hashing
- **THEN** each result log contains only its own ROM code and warnings, and each ROM equals its serial result at a fixed timestamp

### Requirement: Encoding requires allocated games

The internal pipeline SHALL distinguish input, prepared, and allocated games and SHALL encode only complete allocated records without defaulting missing layout metadata to zero.

#### Scenario: Missing or disabled game
- **WHEN** a game is disabled or has no ROM data
- **THEN** it contributes no menu entry and does not obstruct valid game allocation

#### Scenario: Public encoding adapter
- **WHEN** a public helper receives a record with an allocation offset but missing block metadata
- **THEN** it rejects the incomplete record instead of encoding a zero block count

### Requirement: Legal output remains compatible

LK builds SHALL preserve menu ordering, hidden key grouping, ROM code calculation, save mapping, public helper entry points, and current noLog behavior.

#### Scenario: Fixed timestamp output
- **WHEN** a valid build uses the existing fixed-time fixture
- **THEN** ROM and save bytes match the pre-change baseline exactly
