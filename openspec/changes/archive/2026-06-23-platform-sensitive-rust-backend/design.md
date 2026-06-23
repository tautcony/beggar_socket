## Context

The repo already has a Tauri shell and a split platform layer, but native behavior is still spread across frontend composables, runtime helpers, and serial gateway code. Serial I/O is especially sensitive on desktop, while the web build still needs to stay a first-class browser app that uses browser-native APIs where they exist.

This change makes Rust the authority for desktop-sensitive operations and keeps the frontend as a thin client over that boundary.

## Goals / Non-Goals

**Goals:**
- Move desktop-sensitive capabilities behind Rust commands and service objects.
- Keep existing burner protocol and application contracts stable.
- Preserve the web runtime as a primary implementation, not a compatibility shim.
- Reduce direct frontend dependence on Tauri/plugin APIs.
- Add tests that pin the Rust/TypeScript contract.

**Non-Goals:**
- Rewriting the burner protocol or application orchestration in Rust.
- Forcing browser execution through the Rust backend.
- Adding a separate standalone native daemon for non-Tauri browser deployments.

## Decisions

### 1. Use a Rust command/service boundary for native operations

The desktop app will expose serial, file export, and runtime metadata through Rust commands in `src-tauri`.

Alternatives considered:
- Keep direct `@tauri-apps/api` and serial plugin calls in the frontend. Rejected because it leaks platform details into feature code.
- Add a separate local backend daemon. Rejected because it adds deployment and lifecycle complexity without solving the current Tauri use case.

The browser runtime stays on browser-native implementations for the same facades, so the shared boundary is about shape, not about routing the web build through Rust.

### 2. Keep the existing TypeScript `DeviceGateway` and `Transport` contracts

The frontend contract stays stable; only the Tauri implementation changes to call the Rust boundary.

Alternatives considered:
- Move the burner transport stack into Rust. Rejected because it duplicates protocol logic and expands the migration scope unnecessarily.
- Change the upper-layer burner APIs. Rejected because it would spread the migration across unrelated modules.

### 3. Use shared facades for file export and runtime metadata

`useCartBurnerFileState` and runtime helpers will call one shared native facade instead of reaching into Tauri APIs directly.

Alternatives considered:
- Keep ad hoc `invoke()` calls in feature code. Rejected because it fragments the platform boundary.
- Hide native calls inside UI components. Rejected because it makes the boundary harder to test and reuse.
- Replace browser-native behavior with Rust equivalents. Rejected because the web build should remain a first-class implementation.

## Risks / Trade-offs

- [Risk] Rust and TypeScript contracts can drift. -> Add contract tests around the command payloads and the gateway/transport behavior.
- [Risk] The extra command hop adds latency. -> Keep command payloads coarse-grained and session-based instead of chatty per-byte calls where possible.
- [Risk] Browser fallback and desktop behavior can diverge. -> Keep a shared facade and test both runtime paths explicitly.
- [Risk] Browser and desktop behavior are intentionally different in their implementation details. -> Keep the shared contract narrow and do not force artificial parity where the runtime APIs differ.
- [Risk] Migration may leave stale frontend imports. -> Add dependency guardrails and remove direct native imports after the bridge lands.

## Migration Plan

1. Introduce the Rust native service module and command surface without changing external behavior.
2. Route file export and runtime metadata through the shared native facade.
3. Rewire the Tauri serial gateway to Rust-backed sessions and keep the existing application contracts.
4. Remove frontend direct imports of serial plugin APIs and native helpers.
5. Run the serial/native contract tests and update the architecture guardrails.

Rollback means restoring the thin frontend wrappers to their previous native calls while keeping the shared contracts intact.

## Open Questions

- Should browser deployments continue to use web-native fallbacks indefinitely, or should the project eventually add a separate native bridge for non-Tauri environments?
