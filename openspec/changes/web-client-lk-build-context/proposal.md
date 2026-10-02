## Why

Concurrent LK builds share a module log, mixing results after asynchronous hashing. Optional GameConfig layout fields also let encoding silently accept incomplete allocation.

## What Changes

- Give every build a local context and log sink.
- Model input, prepared, and allocated games separately in the internal pipeline.
- Preserve public helpers, legal ROM bytes, save mapping, and noLog behavior.
- Add controlled concurrent hashing and compatibility regression tests.

## Capabilities

### New Capabilities

- `lk-build-context`: Isolated LK build state and allocation-aware encoding.

### Modified Capabilities

None.

## Impact

Scoped to LK ROM builder/types and tests. No new dependencies. Capacity tail, large item-list reservation, and save-boundary fixes are deferred to a separate change.
