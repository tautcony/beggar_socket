## MODIFIED Requirements

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

### Requirement: Dependency boundary enforcement for protocol transport integration
The system SHALL enforce architecture rules that prevent modules under `src/protocol` from directly importing concrete serial services from `src/services/serial-service`.

#### Scenario: Protocol adapter imports concrete serial service
- **WHEN** a file under `src/protocol` introduces direct import from `src/services/serial-service`
- **THEN** dependency guardrail checks fail and the change is blocked until the dependency is routed through `platform/serial` transport contracts

#### Scenario: Protocol adapter imports transport contract
- **WHEN** protocol integration code imports `Transport` contracts from `src/platform/serial`
- **THEN** dependency guardrail checks pass for protocol-to-transport boundary validation

## ADDED Requirements

### Requirement: Application-layer domain port dependency enforcement
The system SHALL enforce architecture rules that prevent Burner application-layer use cases from directly importing runtime-specific serial implementations under `src/platform/serial` or concrete modules under `src/services`.

#### Scenario: Burner use case imports runtime serial implementation
- **WHEN** a file under `src/features/burner/application` introduces direct import from runtime serial implementation modules
- **THEN** dependency checks fail and require the dependency to be routed through domain port contracts

#### Scenario: Burner use case imports domain port contracts
- **WHEN** a Burner application use case depends on domain port interfaces and composition-layer adapters
- **THEN** dependency checks pass for application-layer boundary validation
