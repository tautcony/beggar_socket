## Context

Session abort and Promise.race timeout release busy while worker promises remain alive. Flow cleanup currently starts after release. Shared UI reset can force completion.

## Goals / Non-Goals

**Goals:** Exclusive ownership, stale completion protection, cleanup-safe release, unchanged successful results and cancellation display.

**Non-Goals:** Transport recovery, timeout budgets, new translations, connection ownership.

## Decisions

- Preserve startOperation's AbortSignal return; expose a unique symbol operation token in the snapshot. Require that token for completion and recovery transitions, so old completions cannot release a new owner.
- Track idle/running/cancelling/recovering phases alongside busy. Abort requests cancellation without releasing ownership or removing the controller.
- Await onFinally while busy, releasing in a nested finally even if cleanup fails. Keep progress reset conditions and timing before cleanup, and error/cancellation logging unchanged. Nest projection in a finally boundary so cleanup still executes if state synchronization throws.
- After cancellation, skip late onSuccess side effects while preserving the worker return value. Normal success callbacks and returns remain unchanged.
- Timeout rejects promptly but worker settlement owns release. Observe late fulfillment and rejection, retaining busy until either settles.
- Check composable busy before resetting modal/progress; change resetState to request cancellation instead of completing another owner's work.

## Risks / Trade-offs

- A worker that never settles retains busy indefinitely → safer than concurrent device commands; transport-level termination is a separate concern.
- Completion now requires a token → update all repository call sites and verify TypeScript.
