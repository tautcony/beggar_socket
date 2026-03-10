## 1. Session Config Foundation

- [x] 1.1 Define a session-scoped configuration structure that holds `current_config`, `pending_config`, dirty-state tracking, and the latest validation error
- [x] 1.2 Initialize session configuration so `pending_config` starts as a copy of `current_config` when the control plane becomes available
- [x] 1.3 Refactor the existing ROM mode write path so accepted writes update `pending_config` instead of directly changing the active ROM export window

## 2. Parameter Schema And FAT16 View Layout

- [x] 2.1 Define static parameter-group metadata for the initial control-plane surface, including group paths, candidate values, and whether each group uses `SELECT.TXT` or `CONFIG.TXT`
- [x] 2.2 Extend the FAT16 layout and view identifiers to cover parameter-group directories, candidate files, `SELECT.TXT`, and any required `CONFIG.TXT` files under fixed ROM/RAM paths
- [x] 2.3 Update virtual directory rendering so parameter-group directories expose stable candidate files plus a single writable `SELECT.TXT` per selectable group

## 3. Text Rendering And Parsing

- [x] 3.1 Implement shared text renderers for candidate option files, `SELECT.TXT`, and `CONFIG.TXT` using the parameter metadata and pending/current session state
- [x] 3.2 Implement a unified parameter patch parser that accepts `SELECT.TXT` and `CONFIG.TXT` writes, validates values against the parameter metadata, and applies valid changes to `pending_config`
- [x] 3.3 Preserve the latest parse or validation failure without mutating `pending_config` when a writable control file contains malformed or unsupported content

## 4. Status Reporting Integration

- [x] 4.1 Expand `STATUS.TXT` generation to report current values, pending values, unapplied-change state, and the latest configuration error
- [x] 4.2 Ensure candidate option files and control files surface whether a value is currently active, pending, or neither so host-side browsing reflects session state consistently

## 5. Verification

- [x] 5.1 Verify host reads for parameter directories and control files return stable listings and readable text content across reconnects
- [x] 5.2 Verify valid `SELECT.TXT` and `CONFIG.TXT` writes update only `pending_config` and become visible through subsequent reads of `STATUS.TXT` and candidate files
- [x] 5.3 Verify invalid writable-file content leaves the prior pending state intact and exposes the latest error through `STATUS.TXT`
