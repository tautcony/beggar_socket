## 1. Regression tests

- [x] 1.1 Capture fixed-time ROM/save baseline and controlled concurrent hash regression.
- [x] 1.2 Cover missing/disabled games and incomplete public encoding metadata.

## 2. Typed build pipeline

- [x] 2.1 Introduce local BuildContext and explicit input/prepared/allocated types.
- [x] 2.2 Route build through typed phases and retain compatible public helpers.

## 3. Verification

- [x] 3.1 Run focused unit tests, scoped lint, type checking, and OpenSpec validation.

Verification: 19 focused tests pass (builder/context/image utilities), scoped ESLint passes, and strict OpenSpec validation passes. Type checking was run; its current failures are confined to concurrently edited RTC files (AggregateError lib support and optional mock parameters). LK files produce no diagnostics. Main agent coordinates the RTC resolution and final type-check rerun.
