## ADDED Requirements

### Requirement: Exact binary regression assertions
The tests SHALL compare the complete ROM byte sequence without generic per-element deep comparison.

#### Scenario: Repeated builds
- **WHEN** identical inputs are built with a fixed clock
- **THEN** all bytes and generated codes MUST match and the caller configuration MUST remain unchanged

#### Scenario: A differing byte
- **WHEN** the length or any byte differs
- **THEN** the binary assertion MUST fail with useful difference context

### Requirement: Web client quality gates
CI SHALL run lint, type checking, dependency checks, unit tests and production build for Web Client pull requests and main pushes.

#### Scenario: Failed unit test
- **WHEN** a unit test fails
- **THEN** the quality job MUST fail and Pages publishing MUST not proceed
