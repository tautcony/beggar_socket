## Why

The GBA preview can load a selected ROM, but the selected `.sav` remains in the RAM panel and never reaches the emulator. Players cannot resume that save or recover progress from the preview, and resetting or closing the current emulator discards its save memory.

## What Changes

- Load a selected raw GBA save into the emulator before gameplay, with explicit association when ROM and save filenames differ.
- Keep the GBA core's native save window separate from raw SAV file length. Preserve full non-empty images across import, checkpoints, reset, RAM writeback, export, and reimport, padding short prefixes from the initial core backing without changing native allocation.
- Capture completed in-game saves, preserve the latest save through reset, and return changed save data to the RAM file state on close.
- Guard writeback against ROM/save replacement and retain conflicted results for explicit export.
- Add `.sav` export through the existing browser/Tauri file-saving facade.
- Allow local SAV selection without a connected device while preserving device requirements for cartridge operations.
- Correct emulator pause/cleanup handling as part of reliable snapshot and reset behavior.

## Capabilities

### New Capabilities

- `gba-emulator-save-data`: raw GBA save import, validation, session ownership, in-game save capture, reset preservation, guarded RAM-state writeback, offline selection, and cross-runtime export.

### Modified Capabilities

None. Existing container ownership and platform file-export requirements remain applicable without changes.

## Impact

- `web-client/src/components/CartBurner.vue` and `web-client/src/composables/cartburner/useCartBurnerFileState.ts`: session association and guarded RAM file updates.
- `web-client/src/components/operaiton/contracts.ts`, `RomOperations.vue`, and `RamOperations.vue`: save props/events and offline file selection.
- `web-client/src/components/emulator/GBAEmulator.vue` and a small GBA save bridge: initialization, native save-memory access, capture, reset, cleanup, and export controls.
- Existing `web-client/src/platform/native.ts` file-export facade is reused; no new Rust command or emulator dependency is planned.
- All five locale files and focused bridge/component/file-state tests.
- GB/GBC emulation, cartridge save protocols, instant save states, automatic source-file overwrite, cross-page persistence, multi-menu save extraction, and a multi-game save library are outside this change.
