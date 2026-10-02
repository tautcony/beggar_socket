## MODIFIED Requirements

### Requirement: PlatformOps Interface
The adapters SHALL expose only exercised ROM read operations in their active platform operation objects. The exported legacy PlatformOps interface SHALL remain available as a deprecated compatibility type.

#### Scenario: Active ROM operations
- **WHEN** GBA or MBC creates its active operation object
- **THEN** it SHALL contain the protocol ROM read callback without unused bank, CFI, program or erase configuration

### Requirement: CartridgeAdapter Template Methods
CartridgeAdapter SHALL provide a protected shared ROM read execution method used by both concrete adapters. Other hardware operations SHALL retain their concrete implementation and the base public hardware entries SHALL explicitly indicate unimplemented behavior.

#### Scenario: Public read delegation
- **WHEN** readROM is invoked on GBAAdapter or MBC5Adapter
- **THEN** the shared execution SHALL plan bounded chunks, apply explicit bank/power/throttle policy and report the established progress cadence

#### Scenario: Hardware info isolation
- **WHEN** getCartInfo is invoked on a concrete adapter
- **THEN** its hardware-specific CFI sequence SHALL execute without a generic base info template

### Requirement: Subclass Minimality
GBAAdapter and MBC5Adapter SHALL delegate common ROM read execution while retaining explicit hardware policies. Correctness SHALL be evaluated through execution and command transcripts rather than source line limits.

#### Scenario: Exercised convergence
- **WHEN** either public readROM entry executes
- **THEN** a test SHALL demonstrate execution of the shared read loop and existing atomic retry helper

## REMOVED Requirements

### Requirement: Progress Context Factory
**Reason**: A global factory for all operations is outside the exercised ROM read convergence boundary and was not implemented.
**Migration**: The shared ROM read execution owns its speed calculator and progress reporter; other operations retain their established initialization and behavior.
