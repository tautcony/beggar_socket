## Context

AD-D02 and Batch 4 require failures to survive translated service messages and existing domain/CommandResult conversions.

## Goals / Non-Goals

Goals: preserve original cause identity and structured stage/code/recoverable metadata; maintain success/message/data compatibility.
Non-goals: new Result architecture, protocol bytes, RTC, operation ownership, bank planning, or cleanup return-contract changes.

## Decisions

Define neutral CommandError types and a mapping helper under types so services never depend on application implementation. Domain errors reuse these types. Existing structured errors pass through unchanged; legacy message-only failures map without a fabricated Error cause. Catch results attach the original caught object. Business mismatch uses an explicit code with no invented cause. Existing log payload gains optional diagnostic metadata carried to UI state. Reset errors remain observable through its existing callback without changing operation results.

## Risks / Trade-offs

ACK rejection gains ACK_FAILURE with unchanged messages and byte exchange. Platform plain timeout exceptions retain legacy inference; protocol packet-read errors provide stable codes. Domain failures retain the original command result so translated messages and partial data survive conversions. Existing getCartInfo false contract cannot carry an error: preserve its diagnostic and leave contract migration to a later change.
