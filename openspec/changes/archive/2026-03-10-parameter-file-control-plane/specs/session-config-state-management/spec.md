## ADDED Requirements

### Requirement: Session configuration separates current and pending state
The system SHALL maintain a session-scoped `current_config` and `pending_config` so parameter edits do not immediately change the active runtime configuration.

#### Scenario: Device initializes session configuration
- **WHEN** the control plane becomes available for a new session
- **THEN** `pending_config` starts as a copy of `current_config` until the host makes a parameter change

#### Scenario: Host edits a parameter file
- **WHEN** the host writes a valid `SELECT.TXT` or `CONFIG.TXT`
- **THEN** only `pending_config` is updated and `current_config` remains unchanged

### Requirement: Session configuration tracks unapplied changes
The system SHALL track whether `pending_config` differs from `current_config` and expose that distinction to status consumers.

#### Scenario: Pending configuration differs from current configuration
- **WHEN** at least one valid parameter change has been accepted without being committed
- **THEN** the system marks that unapplied changes are present

#### Scenario: Pending configuration matches current configuration
- **WHEN** the pending values are identical to the current active values
- **THEN** the system reports that no unapplied changes are present

### Requirement: Parameter write failures are preserved as session-visible errors
The system SHALL preserve the most recent parameter parsing or validation failure in session state for later status reporting.

#### Scenario: Host writes malformed parameter content
- **WHEN** the host writes malformed or invalid content to a writable parameter file
- **THEN** the system keeps the prior pending configuration unchanged and stores the failure as the latest configuration error

#### Scenario: Host writes a later valid parameter update
- **WHEN** the host writes a subsequent valid parameter update after a previous failure
- **THEN** the system clears or replaces the stored configuration error to reflect the latest successful state

### Requirement: STATUS.TXT reports current state, pending state, and last error
The system SHALL expose control-plane session state through `STATUS.TXT` so the host can confirm accepted changes and detect invalid writes.

#### Scenario: Host reads STATUS.TXT with no pending changes
- **WHEN** the host reads `STATUS.TXT` and `pending_config` matches `current_config`
- **THEN** the returned text shows the active configuration, indicates that no unapplied changes exist, and reports no configuration error

#### Scenario: Host reads STATUS.TXT after a pending change
- **WHEN** the host reads `STATUS.TXT` after a valid parameter update has changed `pending_config`
- **THEN** the returned text shows both the current and pending configuration values and indicates that unapplied changes exist

#### Scenario: Host reads STATUS.TXT after a validation failure
- **WHEN** the host reads `STATUS.TXT` after a writable parameter file was rejected
- **THEN** the returned text includes the latest validation or parsing error summary
