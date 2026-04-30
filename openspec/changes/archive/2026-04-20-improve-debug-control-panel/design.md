## Context

The first simulated-device change moved debug mode onto the production gateway/transport/protocol path, but the control surface stayed shallow:

- `DebugPanel.vue` only exposes a few toggles plus generic quick actions.
- There is no structured way to see the current simulated session state.
- Simulated ROM/RAM content is still opaque from the panel; users cannot intentionally preload memory for a targeted repro.

The new request is broader than a single upload control. The panel should become a real simulation console that lets developers configure how the simulated device behaves and what data it serves.

## Goals / Non-Goals

**Goals:**
- Add richer debug-panel sections for simulation status, runtime behavior, memory/image management, and session actions.
- Allow developers to tune simulated read and write throughput separately from base latency.
- Allow users to load custom binary images into supported simulated memory regions.
- Make the simulated runtime initialize ROM/RAM from the panel-managed image state.
- Keep binary image state session-scoped so large uploads do not go through `localStorage`.
- Provide an explicit way to refresh the active simulated session when configuration changes.

**Non-Goals:**
- Persisting large simulation images across browser restarts.
- Building a hex editor or in-panel binary diff viewer.
- Supporting arbitrary simulated memory regions beyond the currently implemented GBA/GBC ROM/RAM surfaces.

## Decisions

### 1. Store simulation images in `DebugSettings` as session-only state

Persistent scalar settings such as delay, read/write speed, and error probability will stay in `DebugSettings`. Binary simulation images and their metadata will also be managed there, but only in memory for the current page session.

Why:
- The panel already uses `DebugSettings` as its state boundary.
- Large ROM/RAM payloads are not suitable for `localStorage`.

Alternative considered:
- Add a dedicated Pinia store. Rejected for now because the state is local to the debug console and runtime bootstrap, and a broader store migration is not needed for this change.

### 2. Treat image changes as simulated-session configuration, not live memory patching

User-selected images will be applied when a simulated device session is created. If configuration changes while a simulated device is already connected, the panel will offer or trigger a simulated-session refresh path so the new image set takes effect cleanly.

Why:
- This keeps runtime initialization simple and predictable.
- It avoids mutating an in-flight simulated protocol session in ad hoc ways.

Alternative considered:
- Apply image changes directly to the active simulated memory while connected. Rejected because it complicates runtime guarantees and creates ambiguous behavior during ongoing operations.

### 3. Organize the panel around four sections

The improved panel will be structured as:
- session/status summary
- behavior controls, including throughput settings
- simulation data/images
- session actions / file generation helpers

Why:
- The current layout hides important state and mixes controls with actions.
- The panel should answer three questions clearly: what is connected, how will it behave, and what data will it serve.

Alternative considered:
- Keep the existing flat card and append more controls. Rejected because it would become harder to scan as richer settings are added.

### 4. Support platform-specific memory slots explicitly

The first version will expose named slots such as `gbaRom`, `gbaRam`, `gbcRom`, and `gbcRam`, each with known size limits and clear labels.

Why:
- The simulated runtime already has distinct memory areas for those regions.
- Explicit slots are simpler than free-form address ranges and map well to the current adapters.

Alternative considered:
- Generic “upload arbitrary mapped region” support. Rejected because it is harder to explain in UI and not needed for the current simulated runtime.

## Risks / Trade-offs

- [Session-only images can be lost on reload] -> Mitigation: show loaded-file summaries clearly and keep generated test-file actions available.
- [Users may expect image changes to apply immediately] -> Mitigation: expose explicit refresh/reconnect behavior in the panel and automatically refresh the simulated session when safe.
- [Panel complexity can grow quickly] -> Mitigation: separate controls into clearly titled sections and keep each action tied to a narrow outcome.

## Migration Plan

1. Extend `DebugSettings` with session-scoped simulation image slots and metadata helpers.
2. Update simulated runtime initialization to consume configured images with size clamping/fallback behavior.
3. Redesign `DebugPanel.vue` around richer sections and add upload/clear controls for supported memory slots.
4. Wire `HomeView.vue` so the panel can refresh the active simulated session after config changes.
5. Add tests for image state management and simulated runtime image application.

Rollback:
- Revert to the previous `DebugPanel.vue` and remove session-image initialization, leaving the earlier simulated runtime behavior intact.

## Open Questions

- None required to start implementation; image persistence beyond the current session can be handled later if needed.
