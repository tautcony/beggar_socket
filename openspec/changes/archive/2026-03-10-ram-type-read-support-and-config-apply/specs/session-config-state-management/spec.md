## MODIFIED Requirements

### Requirement: Session configuration separates current and pending state
The system SHALL maintain a session-scoped `current_config` and `pending_config` so parameter edits do not immediately change the active runtime configuration, and SHALL allow an explicit apply action to promote pending state into current state.

#### Scenario: Device initializes session configuration
- **WHEN** the control plane becomes available for a new session
- **THEN** `pending_config` starts as a copy of `current_config` until the host makes a parameter change

#### Scenario: Host edits a parameter file
- **WHEN** the host writes a valid `SELECT.TXT` or `CONFIG.TXT`
- **THEN** only `pending_config` is updated and `current_config` remains unchanged

#### Scenario: Host applies pending configuration
- **WHEN** the host triggers apply after valid pending changes exist
- **THEN** `current_config` is updated to match the accepted `pending_config`
