## MODIFIED Requirements

### Requirement: Dependency boundary enforcement for protocol transport integration
The system SHALL enforce architecture rules that prevent modules under `src/protocol` from directly importing concrete serial services from `src/services/serial-service`.

#### Scenario: Protocol adapter imports concrete serial service
- **WHEN** a file under `src/protocol` introduces direct import from `src/services/serial-service`
- **THEN** dependency guardrail checks fail and the change is blocked until the dependency is routed through `platform/serial` transport contracts

#### Scenario: Protocol adapter imports transport contract
- **WHEN** protocol integration code imports `Transport` contracts from `src/platform/serial`
- **THEN** dependency guardrail checks pass for protocol-to-transport boundary validation

#### Scenario: Protocol module imports runtime-specific serial implementation
- **WHEN** a file under `src/protocol` imports runtime-specific serial implementation modules
- **THEN** dependency checks fail and require protocol communication to use transport abstraction entrypoints

## ADDED Requirements

### Requirement: Protocol public entrypoint dependency enforcement
The system SHALL enforce architecture rules that prevent application-layer modules from importing protocol-internal implementation files outside protocol public entrypoints.

#### Scenario: Application module imports protocol internal utility file
- **WHEN** a file under application-layer modules imports non-public protocol internal paths
- **THEN** dependency checks fail and require importing from protocol public entrypoints

#### Scenario: Application module imports protocol public entrypoint
- **WHEN** an application-layer file imports protocol capability through designated public entrypoint modules
- **THEN** dependency checks pass for protocol boundary consumption
