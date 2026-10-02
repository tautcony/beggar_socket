## Why

AR-05 shows the dependency gate misses relative, dynamic and side-effect imports and cannot detect cycles. AST parsing and consistent module resolution are required for the existing architecture rules to provide meaningful assurance.

## What Changes

- Parse TypeScript and Vue script dependencies with installed compilers.
- Resolve aliases, relative paths and entrypoints consistently; retain existing layer constraints.
- Separate type-only edges from runtime edges and reject runtime cycles with actionable paths.
- Align the obsolete ESLint Electron restriction with the current Tauri implementation.
- Add temporary-fixture regression tests and preserve the check:deps CLI.

## Capabilities

### New Capabilities

- `architecture-dependency-gate`: Syntax-aware dependency boundaries and runtime cycle checks.

### Modified Capabilities

None.

## Impact

Web-client dependency scripts, focused tests and the existing ESLint runtime zone. No dependencies are installed and no public application API changes are planned.
