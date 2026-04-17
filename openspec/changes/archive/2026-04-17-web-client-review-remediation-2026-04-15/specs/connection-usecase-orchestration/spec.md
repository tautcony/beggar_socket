## MODIFIED Requirements

### Requirement: Connection error normalization and recovery semantics
The system SHALL normalize connection and initialization failures into stable error outcomes and SHALL support immediate retry/reconnect without requiring page reload.

#### Scenario: Connect failure normalization
- **WHEN** runtime connection fails due to permission, transport, or device errors
- **THEN** orchestration returns a normalized failure result with stage-aware error classification

#### Scenario: Recovery after failure
- **WHEN** user retries after a failed connection attempt
- **THEN** orchestration starts from a clean connection context and can reach `connected` state without stale failure residue

#### Scenario: Disconnect cleanup failure still clears orchestration state
- **WHEN** the underlying gateway reports a failure while disconnecting
- **THEN** orchestration clears its active connection state before surfacing the failure so the next connect attempt does not inherit stale handles

#### Scenario: Invalid connection context fails fast
- **WHEN** orchestration receives a connection handle whose context cannot be treated as a valid `DeviceHandle`
- **THEN** it returns a normalized connection failure instead of crashing later through an unchecked type assertion

## ADDED Requirements

### Requirement: Connection disconnect regression coverage
The system SHALL provide orchestration-level tests for disconnect cleanup and reconnect after disconnect-path failures.

#### Scenario: Disconnect failure followed by reconnect
- **WHEN** an orchestration test injects a gateway disconnect failure and then retries connection
- **THEN** the suite verifies the retry starts from a clean state and can reach `connected` without a manual page reset
