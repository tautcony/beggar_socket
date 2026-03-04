## MODIFIED Requirements

### Requirement: Dependency boundary enforcement for UI layer
The system SHALL enforce architecture rules that prevent `components` and `views` from directly depending on `protocol` modules.

#### Scenario: New UI file imports protocol module
- **WHEN** a new or modified file under `src/components` or `src/views` imports from `src/protocol`
- **THEN** static checks fail and the change is blocked until dependency routing is corrected

#### Scenario: Existing compliant UI file
- **WHEN** a UI file depends on application/service facade instead of protocol modules
- **THEN** static checks pass for dependency-boundary validation

#### Scenario: Presentational operation component imports platform or services implementation
- **WHEN** a component under `src/components/operaiton` imports from `src/platform` or concrete modules under `src/services`
- **THEN** dependency checks fail and require the dependency to be routed through container/application-layer interfaces

## ADDED Requirements

### Requirement: Containerization boundary enforcement for CartBurner UI
The system SHALL enforce that `CartBurner` presentation components depend only on declared container-facing contracts and SHALL NOT invoke burner orchestration or transport implementations directly.

#### Scenario: Presentational component invokes orchestration implementation directly
- **WHEN** a presentational operation component introduces direct dependency on burner orchestration implementation modules
- **THEN** architecture guardrails fail and require delegation through container-provided handlers

#### Scenario: Container component owns orchestration dependency
- **WHEN** the CartBurner container imports burner orchestration modules and passes handlers to child components
- **THEN** dependency guardrails pass because orchestration ownership remains at the container boundary
