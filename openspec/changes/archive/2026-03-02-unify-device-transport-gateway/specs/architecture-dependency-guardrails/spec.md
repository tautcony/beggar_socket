## ADDED Requirements

### Requirement: Dependency boundary enforcement for protocol transport integration
The system SHALL enforce architecture rules that prevent modules under `src/protocol` from directly importing concrete serial services from `src/services/serial-service`.

#### Scenario: Protocol adapter imports concrete serial service
- **WHEN** a file under `src/protocol` introduces direct import from `src/services/serial-service`
- **THEN** dependency guardrail checks fail and the change is blocked until the dependency is routed through `platform/serial` transport contracts

#### Scenario: Protocol adapter imports transport contract
- **WHEN** protocol integration code imports `Transport` contracts from `src/platform/serial`
- **THEN** dependency guardrail checks pass for protocol-to-transport boundary validation

### Requirement: Platform serial implementation containment
The system SHALL require Web/Electron serial implementation details to be contained under `src/platform/serial` and exposed through shared gateway/transport interfaces.

#### Scenario: Runtime-specific API exposed outside platform serial
- **WHEN** runtime-specific serial APIs are introduced in non-platform modules
- **THEN** architecture validation reports a layering violation and requires the implementation to move behind `platform/serial` boundaries

#### Scenario: Shared upper-layer access pattern
- **WHEN** application or protocol layers need serial capabilities
- **THEN** they consume only shared gateway/transport interfaces and do not branch on runtime-specific APIs
