## Context

LK builds await image loading and SHA-1 calculations while appending to a module log. GameConfig combines caller settings and optional computed fields.

## Goals / Non-Goals

Goals: isolated concurrent logs, explicit phase types, unchanged legal binary output and caller settings.

Non-goals: capacity-tail checks, large item-list reservations, save-boundary corrections, or logging-policy changes.

## Decisions

Pass a BuildContext log sink through the internal pipeline. Keep logp as a console-compatible public entry without shared result storage. InputGame carries settings; PreparedGame requires imported size, index, key and save metadata; AllocatedGame requires offsets and block counts. Encoding accepts AllocatedGame only. Public phase helpers adapt legacy GameConfig callers with explicit validation while preserving valid entry points. Missing and disabled games do not enter allocation.

Serializing builds was rejected because callers can safely overlap when state is local. Keeping optional fields with zero defaults was rejected because it hides incomplete layout.

## Risks / Trade-offs

Public callers may supply malformed phase records → adapters report missing required metadata rather than silently encoding zeros. Existing allocation limits remain unchanged → document separately and retain byte baselines.
