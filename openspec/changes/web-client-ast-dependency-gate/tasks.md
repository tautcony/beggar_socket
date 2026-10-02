## 1. Dependency extraction and resolution

- [x] 1.1 Add regression fixtures demonstrating old parser gaps.
- [x] 1.2 Implement compiler AST extraction and canonical internal module resolution.
- [x] 1.3 Preserve existing boundary rules and update the ESLint Tauri zone with coverage.

## 2. Runtime graph and validation

- [x] 2.1 Detect runtime cycles excluding explicitly type-only edges and investigate the real repository graph.
- [x] 2.2 Verify CLI success/failure diagnostics, focused tests, lint, type-check, dependency gate and strict OpenSpec validation.

Validation: 40 focused tests pass; dependency CLI and strict OpenSpec validation pass. Scoped lint and vue-tsc pass. Full lint was run while another change was being implemented and reported errors in that change's source files; final integration lint remains the parent task's responsibility.
