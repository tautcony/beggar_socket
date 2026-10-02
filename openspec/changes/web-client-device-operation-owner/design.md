## Context

UI sessions are local while tools and debug use the same transport. Gateway disconnect is shared by manual and automatic reconnect flows.

## Goals / Non-Goals

Own every complete UI/service transaction and drain recovery before close. Protocol commands, firmware, RTC implementation and adapter algorithms remain unchanged.

## Decisions

Use an application owner with a weak transport registry in services. Normalize Vue proxies to raw identity. Reject overlap instead of queueing stale UI intentions. Register cancellation requests separately from settlement; only the worker releases ownership. Close enters a blocking state synchronously and waits for worker settlement before gateway disconnect. Failed closes stay blocked and are retryable. Lifecycle disconnect checks its expected handle id inside the queue, so a preceding reconnect cannot redirect an old device close to the replacement. Capture device ownership in adapter callbacks to reject stale progress after replacement.

## Risks / Trade-offs

- Noncancellable tools delay disconnect until completion; preserving device transaction integrity takes priority.
- A worker that never settles keeps close pending, matching the existing transport timeout/recovery contract.
