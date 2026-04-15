## ADDED Requirements

### Requirement: Tauri v2 application shell
The system SHALL provide a Tauri v2 application shell at `web-client/src-tauri/` that loads the Vue 3 frontend in a native window, supporting development mode (dev server at localhost:5173) and production mode (bundled dist/ assets).

#### Scenario: Development mode startup
- **WHEN** the developer runs `npm run tauri:dev`
- **THEN** the Tauri application launches a native window pointing to `http://localhost:5173` with the Vite dev server running concurrently

#### Scenario: Production mode startup
- **WHEN** the application is launched from a packaged build
- **THEN** the Tauri application loads the frontend from the bundled `dist/` directory without requiring a running dev server

### Requirement: Tauri runtime environment detection
The system SHALL provide an `isTauri()` detection function that returns `true` when running inside a Tauri v2 WebView and `false` otherwise, by checking for the presence of `window.__TAURI_INTERNALS__`.

#### Scenario: Detecting Tauri runtime
- **WHEN** the application code calls `isTauri()`
- **THEN** the function returns `true` if `window.__TAURI_INTERNALS__` exists, and `false` otherwise

#### Scenario: Web browser fallback
- **WHEN** the application runs in a standard web browser without Tauri
- **THEN** `isTauri()` returns `false` and the application falls back to Web Serial API behavior

### Requirement: Tauri window configuration
The system SHALL configure the Tauri main window with dimensions, title, and security settings equivalent to the current Electron BrowserWindow configuration, including Content Security Policy and context isolation.

#### Scenario: Window properties
- **WHEN** the Tauri application creates the main window
- **THEN** the window has a title of "ChisFlash Burner", reasonable default dimensions, and CSP headers restricting script sources

#### Scenario: Security isolation
- **WHEN** the Tauri WebView loads frontend code
- **THEN** the frontend cannot access Node.js APIs or file system directly, and all native operations go through Tauri's command/plugin system

### Requirement: Tauri serialplugin permissions
The system SHALL configure Tauri capabilities to grant the serialplugin permissions required for serial port operations, including port discovery, open, close, read, write, binary data transfer, and control signal management.

#### Scenario: Serialplugin permissions granted
- **WHEN** the Tauri application initializes
- **THEN** the capabilities configuration includes permissions for `serialplugin:allow-available-ports`, `serialplugin:allow-open`, `serialplugin:allow-close`, `serialplugin:allow-read`, `serialplugin:allow-write`, `serialplugin:allow-write-binary`, `serialplugin:allow-read-binary`, `serialplugin:allow-write-dtr`, `serialplugin:allow-write-rts`, `serialplugin:allow-start-listening`, `serialplugin:allow-stop-listening`, and `serialplugin:allow-cancel-read`

### Requirement: Cross-platform build support
The system SHALL support packaging the application for Windows (NSIS/MSI), macOS (DMG with universal binary), and Linux (AppImage/deb) using Tauri's built-in bundler.

#### Scenario: macOS build with serial port entitlements
- **WHEN** the application is built for macOS
- **THEN** the resulting DMG contains a universal binary (arm64 + x64) with entitlements that allow serial port access

#### Scenario: Windows build
- **WHEN** the application is built for Windows
- **THEN** the resulting installer packages the application with the WinRT WebView2 runtime

#### Scenario: Linux build
- **WHEN** the application is built for Linux
- **THEN** the resulting AppImage or deb package includes WebKitGTK dependencies declaration

### Requirement: Electron code removal
The system SHALL remove all Electron-related code and dependencies, including the `electron/` directory, Electron-specific npm packages (`electron`, `electron-builder`, `serialport`, `concurrently`, `wait-on`), and the `window.electronAPI` type definitions.

#### Scenario: No Electron runtime artifacts remain
- **WHEN** a developer inspects the codebase after migration
- **THEN** no files in `electron/` directory exist, no `electron` or `electron-builder` packages are in `package.json`, and `src/types/electron.d.ts` is removed

#### Scenario: No Electron imports in source
- **WHEN** a developer searches the `src/` directory for Electron references
- **THEN** no imports of `@/utils/electron`, no references to `window.electronAPI`, and no `isElectron()` calls exist

### Requirement: Environment composable update
The system SHALL update the `Environment` class/composable to use `isTauri()` instead of `isElectron()`, with platform descriptions reflecting "Tauri" or "Web" runtime.

#### Scenario: Tauri environment detection
- **WHEN** `Environment.isTauri` is accessed in a Tauri runtime
- **THEN** it returns `true` and `Environment.description` includes "Tauri"

#### Scenario: Web environment detection
- **WHEN** `Environment.isWeb` is accessed in a standard browser
- **THEN** it returns `true` and `Environment.description` includes "Web"
