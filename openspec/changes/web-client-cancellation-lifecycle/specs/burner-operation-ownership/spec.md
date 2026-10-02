## ADDED Requirements

### Requirement: Exclusive operation ownership
The session SHALL reject reentry while execution or cleanup is pending, and SHALL only release the active operation using its matching token.

#### Scenario: Deferred cancellation
- **WHEN** cancellation is requested before a worker settles
- **THEN** busy remains true and another operation is rejected until worker and cleanup settle

#### Scenario: Stale completion
- **WHEN** an older token completes after a newer operation starts
- **THEN** the newer operation retains ownership

### Requirement: Cleanup and timeout settlement
The session SHALL remain busy through cleanup, release even when cleanup fails, and retain ownership after timeout notification until the underlying worker settles.

#### Scenario: Cleanup failure
- **WHEN** onFinally rejects
- **THEN** the flow rejects and session ownership is released

#### Scenario: Late timed-out worker
- **WHEN** timeout rejects before worker fulfillment or rejection
- **THEN** reentry remains rejected until that worker settles

#### Scenario: Progress projection failure
- **WHEN** cleanup-phase state projection throws
- **THEN** onFinally still runs while busy, and ownership releases after cleanup settles

### Requirement: Late cancellation success handling
The flow SHALL skip onSuccess side effects after cancellation while preserving the worker return value.

#### Scenario: Cancelled worker resolves late
- **WHEN** a cancelled worker resolves instead of rejecting
- **THEN** onSuccess side effects are skipped and the worker return value is preserved

### Requirement: Cancellation presentation survives reentry
The UI SHALL preserve cancelled progress and modal state when a new operation is attempted while cancellation is pending.

#### Scenario: Repeated start after stop
- **WHEN** stop displays paused progress and another start is attempted before settlement
- **THEN** the attempt rejects without resetting progress or starting a worker
