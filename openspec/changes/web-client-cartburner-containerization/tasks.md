## 1. Contract and Structure Baseline

- [ ] 1.1 Define `CartBurner` container responsibilities and the props/events contracts for `ChipOperations`, `RomOperations`, and `RamOperations`
- [ ] 1.2 Create/adjust container-focused composables for burner flow orchestration, file state, and cross-cutting UI state aggregation
- [ ] 1.3 Add or update module exports so presentation components consume only container-provided handlers and state contracts

## 2. CartBurner Containerization Refactor

- [ ] 2.1 Refactor `src/components/CartBurner.vue` into a container-oriented composition that owns orchestration wiring and state transitions
- [ ] 2.2 Migrate progress modal, result modal, logs, busy, and cancel handling into container-managed state
- [ ] 2.3 Update operation panel integrations to emit intent events and receive declarative state without direct protocol/platform/service dependencies
- [ ] 2.4 Remove duplicated or obsolete component-local flow logic after container path is verified

## 3. Orchestration and Guardrail Alignment

- [ ] 3.1 Update burner orchestration integration points to preserve existing flow signatures and user-visible semantics during containerization
- [ ] 3.2 Implement dependency guardrail updates to fail when presentation components import orchestration implementation or platform/service concrete modules
- [ ] 3.3 Verify container-boundary dependency rules pass for intended imports and fail for representative forbidden imports

## 4. Test Coverage and Regression Safety

- [ ] 4.1 Add/extend integration tests for containerized CartBurner read/write/verify success flows with progress and log assertions
- [ ] 4.2 Add/extend integration tests for cancel and failure recovery paths, including state reset and next-operation readiness
- [ ] 4.3 Add/extend component contract tests to detect incompatible props/events changes in operation panels
- [ ] 4.4 Run targeted test suites and dependency checks, then fix regressions until results are stable
