## Why

The client still mixes platform-sensitive behavior across TypeScript feature code and Tauri-specific APIs. That makes serial, file export, and runtime metadata handling harder to keep consistent on desktop, while the web build still needs to remain a first-class browser app with its own native browser APIs.

## What Changes

- Add a Rust-owned native service layer in `web-client/src-tauri/` for desktop serial sessions, file export, and runtime metadata.
- Keep the browser runtime on browser-native implementations behind the same application-facing interfaces.
- Move the frontend to thin typed facades that select a runtime implementation without forcing the web build through Rust.
- Rework the Tauri serial gateway so desktop serial I/O is backed by Rust sessions, while preserving the existing `DeviceGateway` and `Transport` contracts.
- Remove frontend dependencies on direct serial plugin APIs from the Tauri path once the Rust bridge is in place.

## Capabilities

### New Capabilities
- `rust-native-platform-services`: Rust commands and service contracts for desktop serial sessions, file export, and runtime metadata.
- `web-native-platform-services`: browser-native implementations for serial, file export, and runtime metadata behind the same shared facades.

### Modified Capabilities
- `device-transport-gateway`: keep web runtime first-class and ensure runtime routing does not force browser execution through Rust.
- `tauri-serial-gateway`: shift Tauri serial lifecycle and transport behavior from direct frontend native API usage to Rust-backed sessions.

## Impact

- `web-client/src-tauri/` Rust commands and service implementation
- `web-client/src/composables/cartburner/useCartBurnerFileState.ts`
- `web-client/src/utils/tauri.ts`
- `web-client/src/platform/serial/tauri/*`
- `web-client/src/platform/serial/web/*`
- `web-client/src/services/device-connection-manager.ts`
- `web-client/src/components/DeviceConnect.vue`
- `web-client/package.json` and `web-client/src-tauri/Cargo.toml`
- serial and native-service tests, plus architecture dependency checks
