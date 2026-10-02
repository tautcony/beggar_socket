## ADDED Requirements

### Requirement: Shared ROM read execution preserves platform behavior
Public GBA and MBC ROM reads SHALL use one shared execution loop with explicit bank-window, power, bank-switch and throttle strategies, preserving public bytes, result, progress and error behavior.

#### Scenario: Non-aligned bank transition
- **WHEN** a read crosses a GBA 32 MiB or MBC 16 KiB ROM window
- **THEN** each command SHALL fit the current window and use the established byte address mapping and bank sequence

#### Scenario: Platform power and throttle
- **WHEN** MBC 5V read succeeds, fails or is cancelled between chunks
- **THEN** the existing power enable/reset/restore sequence SHALL execute within the existing finally scope and MBC SHALL retain its unthrottled read policy

#### Scenario: Progress and cancellation
- **WHEN** a ROM read runs with showProgress false or cancellation before/between/final chunks
- **THEN** its event flags, cadence, cancellation cause and successful final-command behavior SHALL match the captured baseline

### Requirement: Atomic ROM retry remains shared
ROM reads, GBA verification and both adapters' write blank sampling SHALL retain the same atomic retry entry point, reset and bank restoration order, attempt delays and exhausted error cause.

#### Scenario: Failed command recovery
- **WHEN** a ROM command fails and another attempt remains
- **THEN** channel stabilization SHALL precede bank restoration and the configured attempt-scaled delay before the next read

#### Scenario: Exhausted retry
- **WHEN** all configured attempts fail
- **THEN** the public result SHALL retain the final protocol cause without another reset or retry delay
