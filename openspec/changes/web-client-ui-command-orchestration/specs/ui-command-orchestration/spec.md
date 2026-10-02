## ADDED Requirements

### Requirement: Application prepares command snapshots
The existing burner application SHALL prepare ROM and RAM options, copy CFI, capture imported data buffer identity, pad only short ROM writes with FF, and preserve longer data and loaded RAM read lengths without mutating source bytes.

#### Scenario: Source changes after admission
- **WHEN** source options, CFI arrays or the imported data reference change after a command is admitted
- **THEN** the port receives the original prepared snapshot

#### Scenario: ROM length preparation
- **WHEN** a ROM write selects a size shorter or longer than its loaded buffer
- **THEN** short buffers are padded with FF and long buffers remain untruncated

### Requirement: Command cleanup preserves ownership and diagnostics
The application SHALL attempt command reset exactly once and await its completion before releasing ownership; cleanup failure SHALL preserve the original operation result or primary thrown cause and report structured diagnostics.

#### Scenario: Reset fails after operation failure
- **WHEN** an operation fails and its reset also fails
- **THEN** the original failure remains observable with separate cleanup diagnostics

#### Scenario: Cleanup is delayed
- **WHEN** reset remains pending after command I/O finishes
- **THEN** another operation is rejected until reset finishes

### Requirement: Presentation projection is bound to the admitted flow
The presentation SHALL project results through flow callbacks guarded by session identity, device identity and cancellation. Export names, recent filenames, parsers, date formats, progress flags and validation messages SHALL remain compatible.

#### Scenario: Cancelled or replaced device completes late
- **WHEN** command I/O resolves after cancellation or device replacement
- **THEN** it does not update chip information, toast, pending RAM state or begin export

#### Scenario: Reentrant read cart
- **WHEN** readCart is invoked while another command owns the device
- **THEN** admission rejects it without clearing chip information

#### Scenario: Export dialog remains open
- **WHEN** a read succeeds and its save dialog remains pending
- **THEN** the device owner remains busy and post-dialog projection checks flow identity again
