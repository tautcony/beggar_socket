## 1. Ownership

- [x] 1.1 Add red regressions for deferred cancellation, cleanup failure/delay, stale completion, and late timeout worker settlement.
- [x] 1.2 Implement token-scoped lifecycle and cleanup-safe release.

## 2. UI and validation

- [x] 2.1 Reject composable reentry before resetting progress and remove early reset completion.
- [x] 2.2 Run focused tests, scoped lint, and TypeScript checks; document limitations.

## Validation

- Focused Vitest application/session-state: 31 passed; regression suite first failed as expected before implementation.
- Scoped ESLint: passed without warnings.
- vue-tsc --noEmit: passed.
- git diff --check: passed.
- Worker promises that never settle intentionally retain ownership; physical device recovery remains outside this change.
