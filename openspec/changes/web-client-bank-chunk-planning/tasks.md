## 1. Boundary regressions

- [x] 1.1 Add ROM and SRAM/FRAM boundary regressions and demonstrate failure before implementation.

## 2. Implementation

- [x] 2.1 Add pure bank-window planner with explicit MBC policies and GBA protocol units.
- [x] 2.2 Integrate planner in ROM read/verify and RAM read/write; select GBA banks using absolute addresses.

## 3. Validation

- [x] 3.1 Run planner/adapter/simulation focused tests, scoped lint and type checks; document compatibility.

Validation: six focused test files / 61 tests passed (11.85s), scoped ESLint passed, strict OpenSpec validation and diff checks passed. Global vue-tsc has no errors in this change; unrelated concurrent device-operation-owner tests currently report two missing-argument errors. ROM write recovery and batteryless regression tests passed; runtime and ROM program/erase transcripts remain unchanged.
