## ADDED Requirements

### Requirement: Burner domain port contracts
The system SHALL define explicit Burner domain port contracts for connection lifecycle, protocol execution, and session-state coordination so application use cases remain independent from concrete runtime implementations.

#### Scenario: Use case depends on ports
- **WHEN** a Burner application use case is implemented
- **THEN** it consumes only domain port interfaces and does not import runtime-specific gateway, service, or protocol implementation modules directly

#### Scenario: Port implementation swap
- **WHEN** a Web or Electron adapter implementation is replaced
- **THEN** Burner use case behavior remains functionally equivalent without changing use case orchestration code

### Requirement: Unified domain result model across ports
The system SHALL expose a unified domain result model for success, failure, and progress events across Burner domain ports.

#### Scenario: Port success result handling
- **WHEN** a connection or protocol operation succeeds through a domain port
- **THEN** callers receive a standardized success result shape with optional payload fields relevant to the operation

#### Scenario: Port failure result handling
- **WHEN** a connection or protocol operation fails through a domain port
- **THEN** callers receive a normalized failure result with stable error classification consumable by Burner orchestration and UI mapping

### Requirement: Domain port contract verification
The system SHALL provide contract-level tests for Burner domain ports to verify compatibility across runtime-specific adapters.

#### Scenario: Contract test against multiple adapters
- **WHEN** the same domain port contract suite runs against Web and Electron adapters
- **THEN** both implementations satisfy required method behavior and normalized result semantics
