## ADDED Requirements

### Requirement: Independent native session ownership
Native commands SHALL serialize access within each session without retaining the global registry lock across port operations.

#### Scenario: Another session is blocked
- **WHEN** session A is blocked in serial I/O
- **THEN** session B commands and registry lookup remain available

### Requirement: Close joins actual resource termination
Close SHALL mark the session closing, reject new operations including previously looked-up owners, and report completion only after active operations return and the port is disposed exactly once.

#### Scenario: Close races operation lookup
- **WHEN** close starts before an operation acquires the session lock
- **THEN** the operation is rejected and concurrent closes wait for actual disposal

### Requirement: Cooperative cancellation and exact I/O
Read and write SHALL retain command bytes, exact read length, total deadlines, and string error contracts while observing closing between bounded serial calls. Driver calls SHALL NOT be represented as forcibly cancellable.

#### Scenario: Fragmented read
- **WHEN** bytes arrive in fragments with interrupted or slice-timeout calls
- **THEN** the read returns the exact bytes within the original total deadline or an error

#### Scenario: Close during blocking flush
- **WHEN** flush remains blocked in the driver
- **THEN** close remains pending until flush returns and the port is dropped

### Requirement: Native packaging quality gate
Desktop packaging SHALL require successful cargo check --locked and cargo test --locked.

#### Scenario: Native regression
- **WHEN** native checking or tests fail
- **THEN** the shared quality gate fails before packaging
