## Context

See `proposal.md` for motivation. `CartBurner` owns separate ROM/RAM file state through `useCartBurnerFileState`; `RomOperations` launches `GBAEmulator` with only ROM bytes/name. The RAM panel accepts `.sav/.ram` but disables local selection when disconnected.

Inspection and disposable probes against installed `gbats@1.0.9` established:

- `emulator.setSavedata()` imports raw save memory; `emulator.mmu.save.buffer` exposes it for copying. The persistence/download methods are effectively empty. Wrapper save-state APIs serialize emulator execution state and are not raw SAV APIs.
- SRAM 32 KiB, Flash 64/128 KiB (including bank switching), and EEPROM 512 B/8 KiB import and protocol writes passed synthetic probes. No real-game compatibility claim follows from these probes.
- `resetEmulator()` recreates save memory. Wrapper construction and reset schedule automatic execution. `Wrapper.pause()` checks an uninitialized wrapper field and did not pause in the probe; `emulator.pause()` did.
- EEPROM starts with an 8 KiB allocation. Runtime address widths 6/14 correspond to effective capacities 512 B/8 KiB; the latter produced `realSize = 131072`, so that field is not a reliable export length.
- Native `storeSavedata()` is called after the core observes a settled write burst. This is a useful checkpoint, not proof that the game's entire multi-step save operation has completed.

## Goals / Non-Goals

**Goals:** Keep raw save ownership explicit, make initialization/reset deterministic, and preserve container-owned file state and existing platform export routing. Give the dependency-specific behavior a small, independently testable boundary.

**Non-Goals:** See proposal scope exclusions. Do not alter cartridge protocol behavior or infer physical cartridge RAM type from emulator save type. Session checkpoints are memory-only and do not promise recovery after page reload, application termination, or navigation away from the container.

## Decisions

### 1. Extend the existing container contract

Pass `saveData/saveName` and a session identity through `CartBurner → RomOperations → GBAEmulator`. Use typed save checkpoint/result events back through `RomOperations`; panels do not acquire burner services or mutate parent props.

The file-state boundary owns monotonically increasing ROM/RAM revisions. Increment on select, clear, and accepted save writeback, including reselecting the same name or bytes. Launch captures revisions, a unique session ID, ROM name, save name, and independent byte copies. Only an active session with unchanged source revisions and an idle burner may replace RAM file state on close, and its target must be either the associated imported SAV or a RAM selection that was empty at launch. Choosing not to use an existing SAV does not authorize replacing it; new output follows the conflict/export path instead. An accepted writeback follows existing file-selection logging/size behavior but never starts a cartridge operation.

Filename comparison strips the final extension and compares case-insensitively. A mismatch presents both names and requires explicit use of the selected SAV or start without it; cancellation leaves all state intact. Matching names are a convenience, not content authentication. A launch without a SAV generates an output name from the ROM basename plus `.sav`.

Alternative: a global save store or filename-only matching. Both add hidden ownership or permit stale results to replace unrelated data; the existing container plus revision guards is sufficient.

### 2. Isolate gbats access in a small save bridge

Add a module under `src/components/emulator/` with a narrow typed core interface and operations to inspect capacity, validate/import bytes, copy a snapshot, subscribe to settled writes, and dispose. Keep raw memory layout knowledge out of the Vue template and file-state composable. Do not edit `node_modules` or introduce a dependency fork.

Use owned `ArrayBuffer`/`Uint8Array` copies covering exactly the source view's offset and length, including ROM input. Never share parent save memory with the core or return the live core buffer.

Wrap the current core instance's `storeSavedata()` to preserve its existing behavior and capture settled writes. Retain a restoration function and detach it on reset/disposal. Associate every callback with its session/core generation so old callbacks cannot update new sessions. This confines the adaptation of the currently empty method to one module. Merely watching `writePending` periodically was rejected because the core clears it during frame execution and polling can miss it.

### 3. Use explicit save type and effective capacity

| Detected ROM save type | Native core window | Raw input length | Export image length |
| --- | ---: | --- | --- |
| SRAM | 32768 bytes | Any non-empty length | At least 32768 bytes; preserve any longer input |
| FLASH / FLASH512 | 65536 bytes | Any non-empty length | At least 65536 bytes; preserve any longer input |
| FLASH1M | 131072 bytes | Any non-empty length | At least 131072 bytes; preserve any longer input |
| EEPROM | 8192-byte backing; runtime window 512 or 8192 | Any non-empty length | At least the effective runtime window; preserve any longer input |

Use the core's detected cartridge save type and native backing capacity rather than hardware RAM panel settings or a second independent ROM detector. File length does not identify another game or establish incompatibility: raw SAV files have no universal header, so accept any non-empty selected byte sequence as raw data. Unknown ROM save signatures or absent save memory still produce an actionable error. The core's fallback SRAM allocation is not evidence that an unknown ROM supports SRAM saves. Running without an imported save remains available explicitly.

Keep hardware window size separate from the complete raw image length. Store each core's owned raw image in a `WeakMap`; import only the prefix that fits the native backing and never resize the gbats allocation. On capture, overwrite the image prefix with the effective core window and keep every byte after that window unchanged. The output length grows monotonically to at least the largest effective window reached. For a short input, fill the remainder of the initial core window from the core's pre-import backing and use the same normalized image as the initial baseline and checkpoint. Payload `capacity` remains the core window while payload `data.length` is the full raw image length.

Raw SAV files have no universal header or magic value. Neither length nor byte patterns can reliably prove which game created a raw image or distinguish every unrelated raw format. Filename matching is only a user prompt and is not format authentication. Do not reject a non-empty raw image because its length differs from the ROM's core window or claim arbitrary raw files are identifiable.

For EEPROM, retain a native 8 KiB backing and allow the core's protocol address width to determine the active window. Address widths 6 and 14 map to 512 and 8192 bytes. A 512- or 8192-byte input can hint at the initial window only until runtime width is known; any other non-empty length uses an 8 KiB hint. Runtime width supersedes the hint without an error, while the complete raw image and suffix remain intact. With no imported save and no established width, do not offer an ambiguously sized export. Do not derive output length from `realSize` or scan for nonzero/trailing bytes.

Empty files remain invalid. The bridge does not claim to identify wrapped or unrelated raw formats from their contents; users choose which selected file to load.

### 4. Centralize lifecycle checkpoints

Initialization is synchronous through ROM creation, immediate `emulator.pause()`, save validation/import, bridge attachment, and setup of existing handlers. Resume only after import succeeds. Wrapper's scheduled first frame cannot execute before the synchronous pause. On failure, pause and dispose the partial core and retain the original inputs for correction/retry; do not silently run a blank save.

Keep an imported/initial baseline and the latest stable checkpoint. Completed write notifications send copied checkpoints to the container for recoverable session output, without immediately replacing the selected RAM file or changing the launch revisions. Compare bytes against the baseline to determine whether the session has changed; importing a file alone is not a change.

Reset pauses the core, captures a stable snapshot, disposes old hooks/audio, recreates the core, immediately pauses it, reinjects the latest save, reattaches handlers, and restores the previous play/pause state. It does not reimport the original source SAV over newer gameplay progress. Retry after a runtime error uses the latest valid checkpoint for the same ROM/session.

Normal close takes a final stable snapshot and sends an idempotent result to the container before cleanup. If a storage burst is pending, let an already running core settle for a bounded 500 ms before pausing and capturing; do not advance a user-paused core automatically. If it cannot settle, keep the dialog open with an actionable message to resume/finish saving and retry. A runtime error still permits export/recovery of the last valid checkpoint with an explanation. An unexpected unmount performs best-effort checkpoint delivery and always stops the core; it cannot guarantee a new stable snapshot.

All cleanup paths call `emulator.pause()` regardless of the UI pause flag, detach bridge/keyboard handlers, stop audio, and ignore stale async completions. Deliberate ROM replacement ends the old session using its original identity before initialization of the new one. Save props are launch inputs, not a live watcher that can reset an active game or echo a writeback back into it.

### 5. Keep conflicting results recoverable

If ROM/RAM revisions changed, the session is stale, or the burner is busy, do not apply automatic writeback. Retain the latest completed output in container memory and show a recoverable result with export/discard actions, including its original ROM/save names. Duplicate close/unmount delivery is deduplicated by session ID. Resolve the pending output before launching another preview so a later result cannot silently replace it.

This temporary recovery UI is not a save library. Source file replacement and actual disk saving remain explicit user actions. Cancelling/failed export does not discard pending output.

### 6. Reuse platform export and separate local selection from device I/O

The emulator/result UI exports copied bytes through `saveBinaryFile()` and honors `{ saved: false }` as cancellation. Pause the core before snapshot/export; when writes are pending, offer the last valid checkpoint with an explicit explanation instead of exporting a partial buffer as current progress. Restore the prior pause state after the save dialog. Browser success means the download was initiated; only desktop can report a saved path. Success/cancellation/error messages must reflect that distinction. Export does not clear the session's ability to return data to RAM on close.

Remove the device connection condition from local RAM file selection, clearing, and download controls while retaining the busy guard. Cartridge read/write/verify controls retain their connection/busy conditions. Add localized association, validation, pending-save, conflict, export, and recovery text to all five locales.

Use RAM consistently in user-facing file labels, preview actions, association prompts, recovery messages, and operation logs in every locale; keep actual `.sav`/`.ram` extensions and hardware identifiers intact. The existing file-card download icon is the single download entry for the selected RAM file; do not add a second download button to the RAM operation row. Route that shared file-card action through `saveBinaryFile()` so browser downloads and Tauri save dialogs use the existing platform implementation. Cancellation or failure leaves the current file selected.

### 7. Preserve all ARM mode bits in gbats SPSR writes

The installed `gbats@1.0.9` core defines `PRIV_MASK = 0xcf`, which excludes CPSR mode bit M4 (`0x10`). Its `MSR SPSR` implementation reuses this mask to merge SPSR control bits. In FIQ mode, writing SPSR control value `0x3f` therefore stores `0x2f`; `MOVS PC, LR` then tries to restore reserved mode `0x0f` and gbats throws. A direct instruction-level probe reproduced this path with the installed core; setting only the live core mask to `0xdf` preserved `0x3f` and returned to System/Thumb.

Apply a small compatibility helper to each newly constructed core after the synchronous pause and before save setup or any frame execution. It adds M4 and keeps the Thumb state bit (`0x20`) excluded from `PRIV_MASK`. This restores mode-bit preservation in the existing instruction implementation, does not coerce invalid mode values, and leaves gbats' invalid-mode exception visible. The helper is idempotent and runs on initial construction, reset, and retry.

This follows the ARM7TDMI-S Technical Reference Manual, §2.8.2 and Table 2-2 (pp. 2-17–2-18): mode is M[4:0], the valid System encoding is `11111`, and an illegal mode value is unrecoverable. [Official ARM manual](https://documentation-service.arm.com/static/5e8e13a9fd977155116a3368). The same missing-M4 mask is present in the current official gbats source and its gbajs2 upstream, so this is isolated as an application-side compatibility adaptation rather than a dependency edit.

### 8. Hold GBA keyboard buttons until physical keyup

The GBA wrapper's `press()` helper schedules an automatic release after roughly 100 ms. Keyboard events therefore update the core's active-low `keypad.currentDown` bits directly: a non-repeat keydown clears the mapped bit, and keyup sets it after the last physical key mapped to that button is released. Track held physical `KeyboardEvent.code` values so OS repeat cannot create new presses and release-all transitions do not let a stale repeat resurrect an input.

Release all held keys on window blur, document hide, pause, export, close start, runtime/save errors, reset, retry, core disposal, preview hide/replacement, and unmount. Accept a new gameplay key only while the preview is visible, initialized, running, and not exporting or closing. This handling is limited to GBA; GB/GBC input paths are unchanged.

## Risks / Trade-offs

- [Dependency internals change] → Isolate hooks/layout in the bridge and exercise the installed real core in protocol tests. Re-evaluate these tests when upgrading gbats.
- [Unknown or patched ROM save detection] → Reject imports when the core cannot establish a save type; do not treat fallback allocation as detection. Raw file length alone is not a compatibility test. Multi-menu/batteryless ROM conversion is excluded.
- [A game saves across several transactions] → Checkpoints reflect settled storage bursts; instruct users to complete in-game saving before close/export. Do not claim game-level transactional guarantees.
- [EEPROM runtime window is unknown] → For imported images, use the documented size hint until runtime establishes a window; for a new save with no hint, keep export unavailable until runtime determines it. Preserve the complete raw image if the runtime window differs from that hint.
- [Application termination loses memory-only recovery] → Clearly scope recovery to the current container lifetime; durable persistence remains separate work.
- [UI/core/audio state diverges during lifecycle transitions] → Centralize transitions, pause the actual core, dispose idempotently, and guard callbacks by generation.

## Migration Plan

No stored-data migration or new platform permission is required. Ship the bridge and extended component contracts together, preserving ROM-only launch and GB/GBC behavior. Validate the change with focused tests, type/dependency/lint checks, and real-game browser/Tauri smoke checks. Rollback removes the added save integration; exported SAV files remain standard raw files and remain usable elsewhere.
