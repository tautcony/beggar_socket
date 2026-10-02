## Context

operationTimeout defaults to 30000 ms but is unused. WebSerial waits for each next chunk with an idle timeout; Tauri reads share a total deadline. Burner ownership must last through command-buffer reset and real worker settlement.

## Goals / Non-Goals

Goals: optional execution deadline, preserved default compatibility, explicit timeout diagnostics and actual recovery ownership.
Non-goals: forced interruption of RAM atomic commands, OS flush cancellation, unifying backend packet semantics.

## Decisions

The separate boolean timeout.operationBudgetEnabled defaults false and old snapshots omit it safely. Admission snapshots enabled state and milliseconds. Flow creates a cancellable session when budget is enabled, schedules abort with a structured session timeout reason, and awaits execute without racing ownership release. The first abort reason wins. Deadline reporting retains any late worker error as cause. Timer stops after execute (including command reset), before success projection/file dialogs. Final recovery still holds ownership.

## Risks / Trade-offs

RAM operations do not consume AbortSignal and may finish after budget expiration; suppress success and wait for actual completion. Driver I/O and flush can take their original timeouts. A budget requests cancellation rather than guaranteeing instantaneous stop. Existing runWithTimeout remains a compatibility API with late-worker ownership; UI budget uses the real flow instead.
