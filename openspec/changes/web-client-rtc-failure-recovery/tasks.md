## 1. Recovery regression coverage

- [x] 1.1 Add protocol command failure injection for GBA and MBC3 transactions, clock control restoration, and cleanup-error observability.

## 2. Transaction recovery

- [x] 2.1 Add a shared finally cleanup helper preserving primary errors.
- [x] 2.2 Restore MBC3 control on interrupted writes and idle mapping after all transactions; keep RAM enabled through readback.
- [x] 2.3 Run GBA chip-select/GPIO cleanup independently once per transaction scope.

## 3. Validation

- [x] 3.1 Run RTC input/recovery tests, scoped ESLint, and vue-tsc with explicit Node 24; document results and limitations.
