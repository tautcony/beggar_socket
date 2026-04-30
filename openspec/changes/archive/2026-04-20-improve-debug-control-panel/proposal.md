## Why

The current debug control panel only exposes a few primitive toggles and quick actions. It cannot inspect the active simulated session in a useful way, and it cannot preload the simulated device with user-chosen ROM/RAM content, which makes targeted debugging and protocol verification awkward.

We need the panel to become a richer simulation console so developers can shape the simulated device state intentionally instead of relying on defaults or one-off helper actions.

## What Changes

- Redesign the debug control panel around simulation-console workflows instead of a small list of generic toggles.
- Add richer simulation settings, including clearer session status, base delay, read/write speed controls, error controls, and explicit simulated-session actions.
- Allow users to load and clear user-specified simulated memory images for supported areas such as GBA ROM/RAM and GBC ROM/RAM.
- Surface loaded simulation resources in the panel so users can see which images will back the next simulated session.
- Wire the simulated runtime to initialize device memory from panel-managed simulation images instead of always using generated defaults.
- Add validation and tests for simulation-image configuration and application to the simulated runtime.

## Capabilities

### New Capabilities
- `debug-simulation-console`: Define the richer debug control panel behavior, including simulation status, image management, and session actions.

### Modified Capabilities
- `debug-simulated-device`: Extend simulated-device behavior so user-configured ROM/RAM images can be applied to simulated sessions.

## Impact

- Affected code: `src/components/DebugPanel.vue`, `src/views/HomeView.vue`, `src/settings/debug-settings.ts`, `src/platform/serial/simulated/runtime.ts`, related locale files and tests.
- New behavior: debug panel manages session-only simulation images and can request simulated session refresh/reconnect when configuration changes.
- Verification: add tests for debug-settings simulation image state and for simulated runtime reading user-provided images.
