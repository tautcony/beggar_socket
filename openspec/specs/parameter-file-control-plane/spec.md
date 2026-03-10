## Purpose

Define the fixed parameter-control-plane files and directories exposed through the virtual FAT16 disk.

## Requirements

### Requirement: Parameter groups are exposed as fixed virtual directories
The system SHALL expose parameter groups as firmware-defined virtual directories with stable paths, fixed candidate files, and fixed control files rather than host-created filesystem state.

#### Scenario: Host opens a parameter group directory
- **WHEN** the host reads a supported parameter group directory such as `/RAM/TYPE`
- **THEN** the device returns a stable directory listing containing the firmware-defined candidate files and the group control file `SELECT.TXT`

#### Scenario: Parameter group layout remains stable across mounts
- **WHEN** the device is disconnected and reconnected without firmware change
- **THEN** the same parameter group paths and file names remain visible to the host

### Requirement: Candidate option files are read-only descriptive views
The system SHALL present each candidate option file as a read-only descriptive view of one selectable value in a parameter group.

#### Scenario: Host reads a candidate option file
- **WHEN** the host reads a candidate option file such as `/RAM/TYPE/SRAM.TXT`
- **THEN** the returned text identifies the option, the group it belongs to, and whether it matches the current or pending selection

#### Scenario: Host attempts to write a candidate option file
- **WHEN** the host writes to a candidate option file
- **THEN** the device preserves read-only semantics and does not treat that write as a selection command

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

### Requirement: CONFIG.TXT accepts batch updates for composite parameters
The system SHALL expose `CONFIG.TXT` for parameter sets that require multiple keyed values to be edited together.

#### Scenario: Host writes CONFIG.TXT with multiple fields
- **WHEN** the host overwrites a supported `CONFIG.TXT` with valid `KEY=VALUE` lines for that parameter set
- **THEN** the device applies the validated field updates to the corresponding pending configuration fields in one logical operation

#### Scenario: Host reads CONFIG.TXT
- **WHEN** the host reads a supported `CONFIG.TXT`
- **THEN** the returned text shows the writable keys and the current pending values for that parameter set
