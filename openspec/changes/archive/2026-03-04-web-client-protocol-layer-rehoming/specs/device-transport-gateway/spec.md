## MODIFIED Requirements

### Requirement: Unified protocol transport contract
The system SHALL provide a `Transport` contract exposing `send`, `read`, and `setSignals` operations that protocol-layer code can use independent of runtime-specific serial implementations.

#### Scenario: Protocol send/read through transport
- **WHEN** protocol logic performs packet send and packet read operations
- **THEN** it uses only `Transport` operations and receives consistent success, error, and timeout behavior regardless of runtime

#### Scenario: Signal initialization through transport
- **WHEN** device initialization requires toggling serial control signals
- **THEN** callers invoke `setSignals` on `Transport` instead of using runtime-specific serial APIs directly

#### Scenario: Protocol layer consumes transport-only contract
- **WHEN** protocol modules perform communication for Burner flows
- **THEN** protocol call paths consume only `Transport` contract APIs and do not depend on concrete serial service classes

### Requirement: Device selection and transport association
The system SHALL expose a gateway result model where selected/connected device context includes or resolves the associated `Transport` needed by protocol workflows.

#### Scenario: Connect returns protocol-usable context
- **WHEN** a caller connects to a selected device through `DeviceGateway`
- **THEN** the returned context can provide a `Transport` instance required by protocol adapter operations

#### Scenario: Disconnect invalidates transport usage
- **WHEN** the caller disconnects a device through `DeviceGateway`
- **THEN** subsequent operations through the associated transport fail predictably until a new connection is established

#### Scenario: Protocol receives transport through gateway context only
- **WHEN** Burner orchestration invokes protocol operations
- **THEN** protocol-facing code receives `Transport` from gateway context and never from direct runtime-specific serial implementation imports
