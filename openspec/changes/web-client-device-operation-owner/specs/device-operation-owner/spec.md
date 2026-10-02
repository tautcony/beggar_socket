## ADDED Requirements

### Requirement: Complete device transactions are exclusive
The client SHALL reject overlapping burner, tool and debug operations for the same transport, retaining ownership through recovery.

#### Scenario: Two panels or a tool overlap
- **WHEN** another operation starts while a burner worker or reset is pending
- **THEN** it is rejected before any device command is sent

### Requirement: Closing drains device operations
Disconnect and reconnect SHALL synchronously prevent new operations and await active worker and recovery settlement before closing the transport. Close failure SHALL remain blocked and allow close retry.

#### Scenario: Disconnect during cancellation
- **WHEN** disconnect starts during an active cancellable operation
- **THEN** cancellation is requested and close waits for the worker and cleanup

#### Scenario: Retry failed close
- **WHEN** gateway close fails
- **THEN** new work remains blocked and a later disconnect retries closing

### Requirement: Connection identity protects callbacks
Adapter activity and progress SHALL remain associated with the connection that created them.

#### Scenario: Replacement device
- **WHEN** an old adapter reports progress after the UI device is replaced
- **THEN** it does not update the replacement device progress
