## Purpose

Define enforceable dependency boundaries for the web-client architecture and provide a repeatable guardrail workflow that blocks newly introduced layer violations.

## Requirements

### Requirement: Dependency boundary enforcement for UI layer
The system SHALL enforce architecture rules that prevent `components` and `views` from directly depending on `protocol` modules.

#### Scenario: New UI file imports protocol module
- **WHEN** a new or modified file under `src/components` or `src/views` imports from `src/protocol`
- **THEN** static checks fail and the change is blocked until dependency routing is corrected

#### Scenario: Existing compliant UI file
- **WHEN** a UI file depends on application/service facade instead of protocol modules
- **THEN** static checks pass for dependency-boundary validation

### Requirement: Dependency boundary enforcement for foundation layer
The system SHALL enforce architecture rules that prevent `types` and `utils` from directly depending on `services` modules.

#### Scenario: Utility file imports service module
- **WHEN** a file under `src/utils` introduces direct import from `src/services`
- **THEN** static checks fail and indicate a foundation-to-service dependency violation

#### Scenario: Type file imports service module
- **WHEN** a file under `src/types` introduces direct import from `src/services`
- **THEN** static checks fail and indicate required type extraction or dependency inversion

### Requirement: Baseline-aware violation detection
The system SHALL provide a dependency checking mechanism that distinguishes historical baseline exceptions from newly introduced violations during migration.

#### Scenario: Historical allowlisted violation
- **WHEN** dependency checks encounter a known baseline exception
- **THEN** the check output records architecture matrix information without failing solely due to that exception

#### Scenario: Newly introduced non-allowlisted violation
- **WHEN** dependency checks detect a new violation outside the baseline allowlist
- **THEN** the check exits with failure and reports source file, import path, and violation reason

### Requirement: Guardrail execution in developer workflow
The system SHALL expose architecture dependency checks through a documented and executable project command.

#### Scenario: Developer runs dependency guardrail command
- **WHEN** `check:deps` is executed in the web-client project
- **THEN** the command prints dependency edge summary and enforces failure on non-allowlisted violations

#### Scenario: Team follows guardrail documentation
- **WHEN** contributors consult architecture guardrail documentation
- **THEN** they can identify enforced boundaries, baseline exceptions, and expected integration points (local and CI)

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

### Requirement: Protocol public entrypoint dependency enforcement
The system SHALL enforce architecture rules that prevent application-layer modules from importing protocol-internal implementation files outside protocol public entrypoints.

#### Scenario: Application module imports protocol internal utility file
- **WHEN** a file under application-layer modules imports non-public protocol internal paths
- **THEN** dependency checks fail and require importing from protocol public entrypoints

#### Scenario: Application module imports protocol public entrypoint
- **WHEN** an application-layer file imports protocol capability through designated public entrypoint modules
- **THEN** dependency checks pass for protocol boundary consumption

### Requirement: Platform serial implementation containment
The system SHALL require Web/Electron serial implementation details to be contained under `src/platform/serial` and exposed through shared gateway/transport interfaces.

#### Scenario: Runtime-specific API exposed outside platform serial
- **WHEN** runtime-specific serial APIs are introduced in non-platform modules
- **THEN** architecture validation reports a layering violation and requires the implementation to move behind `platform/serial` boundaries

#### Scenario: Shared upper-layer access pattern
- **WHEN** application or protocol layers need serial capabilities
- **THEN** they consume only shared gateway/transport interfaces and do not branch on runtime-specific APIs
