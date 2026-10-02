## ADDED Requirements

### Requirement: Preserve structured failures across burner boundaries

The system SHALL preserve structured stage, code, recoverability, and original cause identity through services, protocol ports, use cases, facades, and diagnostics without mutating the input result.

#### Scenario: Protocol or transport failure
- **WHEN** a command catches timeout, abort, transport, or ACK failure
- **THEN** the returned command failure and diagnostic preserve the original caught object as cause and stable available metadata

#### Scenario: Existing structured error
- **WHEN** a result already contains structured error metadata
- **THEN** mapping SHALL retain that error object and its metadata

### Requirement: Compatible command results

The system SHALL preserve healthy success/message/data values and protocol bytes, and SHALL support legacy failure results containing only message without fabricating an Error cause.

#### Scenario: Legacy message-only failure
- **WHEN** a port receives an old failure result with only message
- **THEN** the failure has no invented cause and retains its message

#### Scenario: Verification mismatch
- **WHEN** comparison detects business data mismatch
- **THEN** the result reports verification_mismatch without a fabricated cause

#### Scenario: Successful command
- **WHEN** the command succeeds
- **THEN** the result object and returned bytes remain unchanged
