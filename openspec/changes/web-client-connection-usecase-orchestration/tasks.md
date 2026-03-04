## 1. Connection Contract Foundations

- [ ] 1.1 Define connection orchestration result types and state machine model (`idle/selecting/connecting/connected/disconnecting/failed`)
- [ ] 1.2 Add stage-aware error taxonomy for `list/select/connect/init/disconnect` failures and map gateway errors into normalized domain outcomes
- [ ] 1.3 Define connection context lifecycle rules to invalidate stale transport/session data across failure and reconnect paths

## 2. Use Case Orchestration Implementation

- [ ] 2.1 Implement a connection orchestration use case that sequences `list`, `select`, `connect`, `init`, and `disconnect` with deterministic transitions
- [ ] 2.2 Integrate connection precondition checks into Burner orchestration entry points before operation flows execute
- [ ] 2.3 Implement retry/reconnect behavior from failed states with clean context re-initialization and stable outputs
- [ ] 2.4 Add compatibility adapters/mappings so existing UI call sites can consume new orchestration outputs without semantic regressions

## 3. Gateway Alignment and Integration Wiring

- [ ] 3.1 Update gateway-facing contracts to expose stage-aware failure metadata and fresh context guarantees on reconnect
- [ ] 3.2 Ensure disconnect invalidates prior context and reconnect returns new transport bindings consumable by upper layers
- [ ] 3.3 Refactor `CartBurner` connection trigger paths to use connection orchestration APIs instead of scattered lifecycle calls

## 4. Verification and Regression Safety

- [ ] 4.1 Add integration tests for successful connection lifecycle transitions including `list/select/connect/init/disconnect`
- [ ] 4.2 Add integration tests for failure branches (permission, transport, init failure) with normalized error assertions
- [ ] 4.3 Add integration tests for failed-attempt recovery followed by reconnect and burner operation retry
- [ ] 4.4 Run connection and burner orchestration test suites, then resolve regressions until outputs and state transitions are stable
