## MODIFIED Requirements

### Requirement: SELECT.TXT is the unique group-level selection command file
The system SHALL expose one `SELECT.TXT` file per selectable parameter group as the only writable file used to choose a candidate value for that group, and accepted writes SHALL update pending state rather than immediately changing active runtime behavior.

#### Scenario: Host selects a candidate through SELECT.TXT
- **WHEN** the host overwrites `/RAM/TYPE/SELECT.TXT` with a valid candidate such as `VALUE=SRAM`
- **THEN** the device updates the pending value for the `RAM/TYPE` group to `SRAM`

#### Scenario: Host reads SELECT.TXT
- **WHEN** the host reads a group `SELECT.TXT`
- **THEN** the returned text describes the accepted input format and the current pending selection for that group

#### Scenario: Host writes an invalid candidate through SELECT.TXT
- **WHEN** the host overwrites a group `SELECT.TXT` with a value that is not defined in that group's candidate set
- **THEN** the device rejects the change to pending configuration and records a validation error for status reporting

#### Scenario: Host changes selection without applying it
- **WHEN** the host writes a valid new candidate to `SELECT.TXT` but has not triggered apply
- **THEN** the active runtime behavior continues to use the previously applied current value
