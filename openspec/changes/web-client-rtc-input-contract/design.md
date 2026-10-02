## Context

GBA capability probing and error cleanup occur before validation; MBC3 bounds comparisons allow NaN, fractional and missing values. Both setters retain a caller-owned object across awaits.

## Goals / Non-Goals

**Goals:** Reject malformed runtime inputs before any I/O, validate calendar/ordinal boundaries, and write a stable snapshot.

**Non-Goals:** Hardware recovery, readback verification, changing MBC3 day to a raw counter, or matching the GBA weekday to its date.

## Decisions

Use a shared protected finite-integer snapshot helper for required numeric fields. Each setter validates device-specific bounds synchronously outside its I/O try block. GBA uses Luxon calendar validation after explicit ranges; MBC3 retains current-year ordinal bounds. DateTime convenience methods explicitly reject invalid objects before conversion.

## Risks / Trade-offs

Stricter validation rejects previously coerced values → focused tests cover each field and valid boundaries. Current-year MBC3 semantics retain year-boundary limitations → preserve compatibility and freeze test time for leap-year cases.
