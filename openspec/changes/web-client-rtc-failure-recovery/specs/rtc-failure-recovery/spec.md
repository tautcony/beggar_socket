## ADDED Requirements

### Requirement: RTC transactions restore a defined idle state

Every valid RTC hardware transaction SHALL execute best-effort cleanup after success or failure. MBC3 SHALL release its latch, select bank 0, and disable RAM. GBA SHALL release chip select and disable GPIO. Each independent cleanup step MUST still run when an earlier step fails. Invalid setTime input MUST cause zero I/O, including cleanup.

#### Scenario: Failure during a device command
- **WHEN** any command in a valid read, capability probe, or set transaction rejects
- **THEN** all independent cleanup writes are attempted and read/capability contracts remain compatible

#### Scenario: Invalid set input
- **WHEN** setTime rejects its input before a transaction starts
- **THEN** no device commands or cleanup commands execute

### Requirement: MBC3 interrupted writes restore original clock control

MBC3 SHALL capture the original high/control register before attempting Halt and SHALL attempt to restore it after failure, preserving original Halt, carry, and day-high bits. Success SHALL retain the new day-high and resume the timer. RAM MUST remain enabled through write readback; cleanup MUST follow readback. This recovery MUST NOT promise complete time rollback.

#### Scenario: Failure after Halt
- **WHEN** a set transaction fails after attempting to halt the clock
- **THEN** restoration of the captured high/control register precedes mapping cleanup

#### Scenario: Successful new time
- **WHEN** setTime succeeds
- **THEN** the new time resumes and readback occurs before RAM is disabled

### Requirement: Recovery errors remain observable without replacing the primary cause

Cleanup errors SHALL be logged with the primary operation cause. An operation rejection MUST preserve its original thrown value even when cleanup also fails. Cleanup-only failure MUST be reported as transaction failure without retrying the same cleanup scope.

#### Scenario: Primary and cleanup failure
- **WHEN** an operation and one or more cleanup writes fail
- **THEN** the original operation error is returned or thrown and logs preserve all cleanup errors and the primary cause

#### Scenario: Cleanup-only failure
- **WHEN** the operation succeeds and cleanup fails
- **THEN** setTime rejects or read/capability reports failure and subsequent cleanup steps still run
