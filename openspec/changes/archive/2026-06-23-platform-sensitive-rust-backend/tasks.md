## 1. Rust native service layer

- [x] 1.1 Define the Rust command surface for desktop serial sessions, file export, and runtime metadata in `web-client/src-tauri/src/`
- [x] 1.2 Implement the Rust-backed file save/export command for Tauri only
- [x] 1.3 Implement the Rust-backed runtime metadata command and return a typed DTO to the frontend

## 2. Tauri serial bridge

- [x] 2.1 Refactor the Tauri serial gateway to open, list, init, and close through the Rust native service layer
- [x] 2.2 Refactor the Tauri transport to proxy send, read, signal, and close operations through Rust-backed sessions
- [x] 2.3 Normalize Rust port descriptors into `SerialPortInfo` and keep timeout and recovery semantics stable

## 3. Frontend facades and cleanup

- [x] 3.1 Replace direct native calls in Tauri file export and runtime helpers with shared facades
- [x] 3.2 Keep the browser runtime on browser-native implementations behind the same shared facades
- [x] 3.3 Remove direct frontend imports of serial plugin APIs and other desktop-only native implementation details
- [x] 3.4 Update runtime detection, device connection, and related UI copy to use the runtime-appropriate implementation path

## 4. Tests and verification

- [x] 4.1 Add contract tests for Rust native command success, cancel, and failure behavior
- [x] 4.2 Update Tauri serial gateway and transport tests to cover Rust-backed lifecycle flows
- [x] 4.3 Preserve or add browser-runtime tests so web-native behavior remains first-class
- [x] 4.4 Run type-check, lint, and test suites, then update architecture guardrails if any new native dependency edges appear
