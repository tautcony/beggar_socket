## 1. Input validation

- [x] 1.1 Validate and snapshot finite integer fields before I/O.
- [x] 1.2 Enforce GBA calendar/weekday and MBC3 ordinal bounds and DateTime validity.

## 2. Verification

- [x] 2.1 Add focused invalid-input, boundary, leap-year and mutation tests.
- [x] 2.2 Run focused tests, scoped lint and type check.

Validation: focused tests pass (174/174), scoped ESLint passes. Full vue-tsc was run and reports unrelated TS2554 errors in tests/features/burner/device-operation-owner.test.ts at lines 44 and 151 while parallel work is active.
