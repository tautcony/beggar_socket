## 1. Simulation Configuration State

- [x] 1.1 Extend `DebugSettings` with session-scoped simulation image slots, metadata helpers, and clear/reset APIs
- [x] 1.2 Update simulated runtime initialization so new simulated sessions consume configured ROM/RAM images with size clamping and default fallbacks

## 2. Debug Panel UX

- [x] 2.1 Redesign `DebugPanel.vue` into richer sections for session status, behavior settings, simulation data, and session actions
- [x] 2.2 Add upload, inspect, and clear controls for supported simulated memory slots
- [x] 2.3 Wire panel actions to request simulated session refresh/reconnect when configuration changes need a new session

## 3. Integration And Copy

- [x] 3.1 Update `HomeView.vue` integration so the panel can react to current simulated connection status and refresh the simulated session safely
- [x] 3.2 Update locale strings for the richer simulation-console wording and new controls

## 4. Verification

- [x] 4.1 Add or update tests for debug-settings simulation image state management
- [x] 4.2 Add or update simulated runtime tests to verify user-provided images are applied to new simulated sessions
- [x] 4.3 Run targeted type-check/test verification and complete the OpenSpec task checklist
