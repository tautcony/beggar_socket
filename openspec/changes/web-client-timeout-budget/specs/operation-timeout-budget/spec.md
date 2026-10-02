## ADDED Requirements

### Requirement: Opt-in compatible settings

The client SHALL keep operation budgets disabled by default and validate the enable flag as a boolean atomically.

#### Scenario: Existing snapshot
- **WHEN** a valid legacy or version 1 snapshot omits the flag
- **THEN** normal long operations remain unrestricted by operationTimeout

### Requirement: Real execution ownership

A configured budget SHALL request cooperative cancellation, suppress success after expiry, preserve the first cancellation reason and retain ownership through worker and cleanup settlement. The budget SHALL stop before presentation callbacks.

#### Scenario: Late worker failure
- **WHEN** the budget expires before a worker rejects
- **THEN** timeout diagnostics retain the worker failure and ownership releases only after real cleanup

#### Scenario: User cancellation first
- **WHEN** a user cancels before the deadline
- **THEN** later deadline processing does not replace user cancellation

#### Scenario: Save dialog
- **WHEN** execution finishes before its deadline and a save dialog remains open
- **THEN** the budget does not cancel the presentation callback

### Requirement: Backend timeout semantics

WebSerial SHALL preserve its idle timeout per incoming chunk and Tauri SHALL preserve a shared total read deadline. Timeout failures SHALL carry a stable timeout code and original message.

#### Scenario: Fragmented progress
- **WHEN** chunks keep arriving inside each WebSerial idle window beyond the total timeout duration
- **THEN** the WebSerial read succeeds while a Tauri read has only its original total deadline
