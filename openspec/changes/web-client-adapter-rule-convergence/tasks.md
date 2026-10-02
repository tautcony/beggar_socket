## 1. Baseline

- [x] 1.1 Audit callers and record live read/retry versus unused template boundaries.
- [x] 1.2 Add and run deterministic ROM byte, command, delay, progress, power, cancellation and sampling retry tests before production edits.

## 2. Shared execution

- [x] 2.1 Route GBA and MBC public ROM reads through one explicit-strategy read loop.
- [x] 2.2 Remove unused base info/read templates and concrete phantom PlatformOps configuration while preserving legacy export compatibility.
- [x] 2.3 Verify both reads, GBA verification and write sampling retain the existing atomic retry entry.

## 3. Validation

- [x] 3.1 Run focused adapter/window/sector/simulated/structured-failure suites without changing existing expectations.
- [x] 3.2 Run scoped ESLint, vue-tsc, AST architecture dependencies, strict OpenSpec validation and tracked/untracked whitespace/encoding checks.
- [x] 3.3 Record evidence and affected files for independent review without committing or pushing.
