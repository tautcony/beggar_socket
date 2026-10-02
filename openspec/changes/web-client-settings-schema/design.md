## Context

Settings descriptors already centralize numeric fields and limits. Runtime values currently bypass TypeScript and NaN comparisons. Unversioned storage cannot distinguish old defaults from explicit user choices.

## Goals / Non-Goals

**Goals:** Reject malformed runtime input atomically, preserve finite setter normalization, and protect explicit legacy settings.

**Non-Goals:** Timeout integration, new dependencies, UI changes, and storage key changes.

## Decisions

- Derive allowed groups and fields from descriptors. Validate plain object shapes, known fields, numeric types, finiteness, and integer constraints before applying any mutation.
- Strict validation and persisted snapshots require integers in range. Mutation APIs preserve existing clamping and truncation for finite throttle/retry/delay/timeout input; page sizes reject fractions. Unsupported firmware setters retain the existing stm fallback, while validation and loading reject unsupported profiles.
- Add root `version: 1` only to persisted snapshots. Unversioned snapshots are accepted using the same strict schema and explicit 512/256 byte values are preserved. Unsupported versions or corrupt data reset memory to defaults without overwriting storage.
- Separate restoring defaults in memory from saving them so failed/unknown storage reads cannot destroy recoverable data.

## Risks / Trade-offs

- Strict JSON rejects previously silently coerced values → focused regression tests cover malformed shapes and preserve valid old snapshots.
- Future versions are unreadable → preserve original storage and restore safe in-memory defaults.
- Storage can fail → setters keep valid in-memory state and report persistence failures as before.
