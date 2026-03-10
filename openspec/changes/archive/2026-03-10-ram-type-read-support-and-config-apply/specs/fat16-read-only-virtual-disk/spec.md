## MODIFIED Requirements

### Requirement: Control-plane writes are limited to firmware-defined writable files
The system SHALL limit host writes to the specific control-plane files declared writable by firmware rather than allowing general FAT file mutation, and runtime-visible effects SHALL only change once the relevant configuration has been applied.

#### Scenario: Host writes a declared writable control file
- **WHEN** the host overwrites a firmware-defined writable control file such as `SELECT.TXT` or `CONFIG.TXT` with valid content
- **THEN** the device routes the write through the corresponding control-plane parser instead of mutating FAT allocation state or cartridge payload data

#### Scenario: Host writes any non-writable virtual file
- **WHEN** the host writes `INFO.TXT`, candidate option files, `CURRENT.GBA`, `CURRENT.SAV`, or any other fixed view that is not declared writable
- **THEN** the device preserves existing virtual-file semantics and does not mutate cartridge payload data

#### Scenario: Host updates configuration without applying it
- **WHEN** the host writes valid pending configuration through writable control files
- **THEN** subsequent reads of runtime data windows continue to use the previously applied current configuration until apply completes
