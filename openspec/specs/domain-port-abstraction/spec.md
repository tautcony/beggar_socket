# domain-port-abstraction Specification

## Purpose
TBD - created by archiving change web-client-domain-port-abstraction. Update Purpose after archive.

## Requirements

### Requirement: Burner domain port contracts
The system SHALL define explicit Burner domain port contracts for connection lifecycle, a single consolidated cartridge operation contract (replacing duplicated `BurnerProtocolPort` and `BurnerProtocolSession` layers), and session-state coordination so application use cases remain independent from concrete runtime implementations while preserving `BurnerUseCase` orchestration responsibilities (cart info assembly, full-chip sector calculation, multi-cart scan) and connection error contracts.

#### Scenario: Use case depends on ports
- **WHEN** a Burner application use case is implemented
- **THEN** it consumes only domain port interfaces and does not import runtime-specific gateway, service, or protocol implementation modules directly

#### Scenario: Use case depends on consolidated cartridge contract
- **WHEN** a Burner application use case executes ROM, RAM, erase, or cart-info operations
- **THEN** it consumes the single application-layer cartridge operation contract and does not depend on concrete GBA/MBC adapter classes or a redundant pass-through session wrapper

#### Scenario: Port implementation swap
- **WHEN** a Web, Tauri, or simulated adapter implementation is replaced
- **THEN** Burner use case behavior remains functionally equivalent without changing use case orchestration code

### Requirement: Unified domain result model across ports
The system SHALL expose a unified domain result model for connection orchestration while preserving structured error context and underlying failure reasons across cartridge operations without lossy `CommandResult -> BurnerDomainResult<CommandResult> -> CommandResult` round-trip conversions.

#### Scenario: Port success result handling
- **WHEN** a connection or protocol operation succeeds through a domain port
- **THEN** callers receive a standardized success result shape with optional payload fields relevant to the operation

#### Scenario: Port failure result handling
- **WHEN** a connection or protocol operation fails through a domain port
- **THEN** callers receive a normalized failure result with stable error classification consumable by Burner orchestration and UI mapping

#### Scenario: Cart info failure preserves underlying cause
- **WHEN** `readCartInfo` fails due to unsupported 5V power control, CFI parse failure, timeout, cancellation, or disconnect
- **THEN** the application layer surfaces the underlying failure cause and error classification instead of replacing it with a generic `'No cart info returned'` message

#### Scenario: Connection error contract remains intact
- **WHEN** connection orchestration encounters `selection_required`, `stale_context`, or gateway lifecycle errors
- **THEN** `BurnerDomainResult` and `ConnectionFailure` mapping semantics remain unchanged for connection selection and error presentation

### Requirement: Domain port contract verification
The system SHALL provide contract-level tests for Burner domain ports to verify compatibility across runtime-specific adapters.

#### Scenario: Contract test against multiple adapters
- **WHEN** the same domain port contract suite runs against Web and Electron adapters
- **THEN** both implementations satisfy required method behavior and normalized result semantics
