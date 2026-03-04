## 1. Domain Port Contract Definition

- [ ] 1.1 Define Burner domain port interfaces for connection lifecycle, protocol execution, and session coordination
- [ ] 1.2 Define a unified domain result model for success/failure/progress semantics shared by all Burner ports
- [ ] 1.3 Define port-level error classification and mapping rules for connection, transport, and protocol failure stages

## 2. Adapter and Composition Wiring

- [ ] 2.1 Implement adapters that map existing gateway/protocol implementations to the new domain port interfaces
- [ ] 2.2 Update composition root/factory wiring to inject domain port implementations into Burner application use cases
- [ ] 2.3 Ensure adapter boundaries prevent direct runtime implementation exposure to application-layer consumers

## 3. Burner Use Case Migration

- [ ] 3.1 Refactor Burner use cases to depend only on domain ports instead of concrete gateway/service classes
- [ ] 3.2 Migrate flow-template integration to consume unified domain result semantics without ad hoc per-implementation branches
- [ ] 3.3 Remove or isolate legacy direct-dependency code paths after port-based paths are verified

## 4. Guardrails and Test Verification

- [ ] 4.1 Add/update dependency guardrail rules to fail when `features/burner/application` imports runtime serial/service implementations directly
- [ ] 4.2 Add contract tests that run the same Burner port expectations against Web and Electron adapter implementations
- [ ] 4.3 Add/extend integration tests for Burner orchestration behavior across success/failure/recovery with port-based wiring
- [ ] 4.4 Run dependency checks and relevant test suites, then resolve regressions until behavior and contracts are stable
