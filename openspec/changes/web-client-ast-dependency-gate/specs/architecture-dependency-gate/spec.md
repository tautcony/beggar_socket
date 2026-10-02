## ADDED Requirements

### Requirement: Syntax-aware internal dependencies

The gate SHALL extract literal static imports, side-effect imports, re-exports, dynamic imports, import types and require calls from TypeScript and Vue script blocks, resolve aliases and relative paths to canonical source files, and enforce the existing layer constraints.

#### Scenario: Alternate syntax cannot bypass boundaries
- **WHEN** a forbidden edge uses an alias, relative path, side-effect import, re-export or literal dynamic import
- **THEN** the gate reports its source location and fails

#### Scenario: Text is not a dependency
- **WHEN** a comment, string or Vue template contains apparent import syntax
- **THEN** it does not create an edge

#### Scenario: Resolution preserves entrypoints
- **WHEN** a legal factory imports implementations or a service imports the protocol entrypoint via a relative directory path
- **THEN** the gate resolves the edge without imposing a new boundary restriction

### Requirement: Runtime cycle diagnostics

The gate SHALL reject runtime dependency cycles with a traversable cycle path and SHALL exclude explicitly type-only edges and declaration files from the runtime graph.

#### Scenario: Three-node runtime cycle
- **WHEN** three source modules form a runtime cycle
- **THEN** check:deps fails and reports the participating files in path order

#### Scenario: Type-only return edge
- **WHEN** a runtime edge has only an explicitly type-only return edge
- **THEN** no runtime cycle is reported

### Requirement: Reliable CLI failures

The gate SHALL retain the check:deps command and matrix summary and SHALL fail on boundary violations, runtime cycles, syntax errors and unresolved internal source references.

#### Scenario: Broken internal reference
- **WHEN** an internal source module specifier cannot be resolved
- **THEN** the CLI reports the source location and unresolved specifier and exits with a nonzero status
