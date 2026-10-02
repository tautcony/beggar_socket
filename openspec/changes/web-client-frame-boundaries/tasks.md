## 1. Frame integrity

- [x] 1.1 Enforce total frame and unsigned length bounds while preserving valid bytes and CRC mode.
- [x] 1.2 Validate simulated frames and strip CRC trailers from all writes.
- [x] 1.3 Bound accelerated simulation chunks to safe aligned windows.

## 2. Verification

- [x] 2.1 Add maximum/+1, every write layout and malformed simulated frame tests.
- [x] 2.2 Add 128 KiB SRAM and FRAM simulated adapter round trips.
- [x] 2.3 Run focused tests, ESLint and type checking; record follow-up bank dependency.

Validation: Node 24, 6 focused test files / 55 tests passed; changed-file ESLint passed; vue-tsc executed and reports only concurrent session/connection API changes in application.test.ts and connection-usecase-orchestration.test.ts. No errors in this change's files. Existing Vite configuration warning is unrelated.

Follow-up: Non-aligned base addresses still require per-iteration remaining-bank-window limits in ROM/RAM read, write and verify loops. This change only guarantees frame lengths and safe aligned simulated chunk sizes; it does not implement bank planning.
