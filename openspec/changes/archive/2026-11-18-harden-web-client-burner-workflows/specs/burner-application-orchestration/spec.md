# Spec Delta

## ADDED Requirements

### Requirement: Operation lock held until in-flight work settles
The system SHALL keep the burner session busy after a user cancel or an operation timeout until the running operation's promise settles, SHALL show a cancelling state meanwhile, and SHALL NOT start another device operation before the lock is released.

#### Scenario: Next operation blocked during cancel
- **WHEN** the user stops a ROM write while a program request is in flight
- **THEN** the session stays busy in a cancelling state, a new operation cannot start, and busy clears only after the adapter returns

#### Scenario: Timeout does not release early
- **WHEN** `runWithTimeout` reaches its deadline while the operation is still running
- **THEN** the abort signal is raised and the lock is released only after the operation returns
