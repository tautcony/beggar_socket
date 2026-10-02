## ADDED Requirements

### Requirement: Connection ownership survives failures
The use case SHALL retain ownership until the transport is released and SHALL keep enumeration read-only.

#### Scenario: Enumeration fails while connected
- **WHEN** listing ports fails
- **THEN** the active handle and generation MUST remain unchanged and later disconnect MUST close it

#### Scenario: Close or rollback fails
- **WHEN** cleanup returns failure or throws
- **THEN** the handle MUST remain available for cleanup retry and a new connection MUST not open before cleanup succeeds

### Requirement: Atomic selected-port reconnect
Selected-port reconnection SHALL use a single lifecycle queue operation.

#### Scenario: Concurrent reconnections
- **WHEN** two selected-port reconnects are requested
- **THEN** each close/open/init transaction MUST finish before the next begins

### Requirement: Late native open cleanup
Native opening SHALL release a session obtained after its caller timed out.

#### Scenario: Late success
- **WHEN** opening succeeds after the connection deadline
- **THEN** the session MUST be closed and MUST not be emitted as connected
