## Context

The existing script matches only alias imports with a regular expression. Existing layer constraints and the installed TypeScript/Vue compilers are the baseline.

## Goals / Non-Goals

Goals: extract literal module references from real syntax, resolve them consistently, preserve boundary rules and detect runtime cycles.

Non-goals: dependency installation, new UI restrictions, folder renames or broad application refactoring.

## Decisions

- Use TypeScript AST for import/export, import types, literal dynamic imports and require calls. Parse Vue SFC script and script setup blocks with the installed compiler-sfc.
- Read tsconfig compiler options and resolve with TypeScript; supplement Vue extension resolution using the same paths mapping. Ignore external packages and assets, but report unresolved internal source references.
- Apply boundaries to both type and runtime dependencies; cycles include only runtime edges. Explicit type-only syntax and declaration files cannot create runtime cycles.
- Canonicalize resolved index entrypoints for existing protocol rules. Keep current zones in one checker, including their existing composition-root freedom.
- Print cycle paths and source locations, preserving the matrix and failing exit code. Any real existing cycle requires evidence before a minimal source fix or narrowly documented exception.

## Risks / Trade-offs

- Nonliteral computed imports cannot be statically resolved; this gate covers literal references.
- Compiler parsing does not replace type-checking; syntax diagnostics must fail the gate rather than silently drop edges.
- Runtime classification follows explicit import syntax, matching isolatedModules; unused value imports are conservatively runtime edges.

## Verification Evidence

Running the original HEAD parser against relative, dynamic and side-effect fixtures returned zero edges for each; the new AST extractor returns one each. An apparent import inside a string produced one legacy edge and zero AST edges. The 40 temporary-fixture tests cover these differences, Vue script blocks and external scripts, paths/entrypoints, all existing boundary zones, type-only edges, mixed imports, self/multiple/three-node cycles, CLI status, malformed config and Tauri ESLint behavior.

The repository graph at verification contained 381 runtime and 134 type edges with no runtime cycles, boundary violations or parsing/resolution errors. No cycle exception or source restructuring was necessary. Composition factories retain existing permission to import concrete implementations. Static coverage is limited to literal module specifiers; computed dynamic imports/require targets are not resolved.
