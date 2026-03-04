## 1. Protocol Boundary and Public Entrypoint

- [x] 1.1 Define protocol public entrypoint exports for Burner-facing protocol capabilities under `src/protocol`
- [x] 1.2 Refactor protocol internal module structure so command construction, parsing, and protocol flow composition stay within protocol boundary
- [x] 1.3 Update application-layer imports to consume protocol capabilities only through the public entrypoint

## 2. Transport-Abstraction Alignment

- [x] 2.1 Refactor protocol communication call paths to accept and use `Transport` contract inputs instead of concrete serial-service implementations
- [x] 2.2 Remove direct protocol imports of runtime-specific serial implementation modules and route communication via gateway/transport abstractions
- [x] 2.3 Ensure protocol-to-transport integration preserves runtime parity expectations for Web and Electron behavior

## 3. Canonical Packet-Read Consolidation

- [x] 3.1 Implement one canonical packet-read path shared by protocol operations
- [x] 3.2 Migrate existing protocol operations to reuse canonical packet-read logic and delete duplicated read implementations
- [x] 3.3 Normalize timeout/error mapping in canonical packet-read flow to maintain consistent burner-facing semantics

## 4. Guardrails and Verification

- [x] 4.1 Add/update dependency guardrail rules to block `src/protocol` imports of concrete serial-service/runtime implementation modules
- [x] 4.2 Add/update guardrail rules to enforce application consumption of protocol public entrypoints over protocol-internal paths
- [x] 4.3 Add/extend protocol and burner orchestration tests for packet-read error/timeout consistency after rehoming
- [x] 4.4 Run dependency checks and relevant test suites, then fix regressions until boundary rules and behavior contracts are stable
