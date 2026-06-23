## ADDED Requirements

### Requirement: Rust-native platform service boundary
The system SHALL expose desktop platform-sensitive operations through Rust commands in `src-tauri`, and frontend code SHALL consume them only through shared TypeScript facades.

#### Scenario: Frontend uses shared facade
- **WHEN** a UI component or composable needs serial, file export, or runtime metadata
- **THEN** it calls the shared facade instead of importing native runtime APIs directly

### Requirement: Web runtime remains first-class
The system SHALL keep browser runtime implementations under the web-side platform layer and SHALL NOT route the web build through Rust-backed services.

#### Scenario: Web uses browser-native implementation
- **WHEN** the app runs in a standard browser
- **THEN** the web platform layer uses browser-native APIs and shared interfaces without requiring Rust commands

### Requirement: Rust-backed file export and save dialog
The system SHALL perform desktop file save and export operations through Rust when running under Tauri, while preserving a browser fallback for web runtime.

#### Scenario: Save from Tauri
- **WHEN** a user exports a binary file in Tauri
- **THEN** Rust presents the save dialog, writes the bytes, and returns either the saved path or a cancel result

#### Scenario: Save from Web
- **WHEN** the same export flow runs in a browser
- **THEN** the app falls back to the browser download mechanism and does not require Rust-native APIs

### Requirement: Rust-backed runtime metadata
The system SHALL resolve desktop runtime metadata through Rust commands when available.

#### Scenario: Tauri runtime metadata
- **WHEN** the UI requests app name, version, or runtime identifier in Tauri
- **THEN** Rust returns the native values and the frontend displays them through the shared facade

### Requirement: Native service contract coverage
The system SHALL provide regression tests for the Rust native service facade and its browser fallback behavior.

#### Scenario: Native command failure is surfaced
- **WHEN** a Rust command fails or is cancelled
- **THEN** the frontend receives a deterministic error or cancel result and no stale native state remains

#### Scenario: Browser fallback remains usable
- **WHEN** the app runs outside Tauri
- **THEN** the browser fallback paths still satisfy the same user-facing action
