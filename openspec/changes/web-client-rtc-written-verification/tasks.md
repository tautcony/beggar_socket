## 1. Contract and regression tests

- [x] 1.1 Add focused failing tests for ignored writes, malformed snapshots, retries, ticks/rollovers, and read errors.

## 2. Implementation

- [x] 2.1 Replace log-only BaseRTC paths with bounded monotonic verification.
- [x] 2.2 Verify GBA typed target/status in the existing session with calendar/weekday progression.
- [x] 2.3 Verify MBC3 coherent raw counter/control with finally unlatch and existing restoration.

## 3. Validation

- [x] 3.1 Update input mocks and recovery models without weakening command failure coverage.
- [x] 3.2 Run all RTC tests, scoped ESLint, vue-tsc, and OpenSpec validation; document outcomes and hardware limitations.
