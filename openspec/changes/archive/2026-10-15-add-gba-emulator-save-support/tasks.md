## 1. Save bridge and capacity rules

- [x] 1.1 Add a narrow typed GBA save bridge with exact-range owned byte copies and detected save descriptors; verify tests cover sliced ROM/SAV views, mutation isolation, absent memory, and unknown signatures without relying on fallback SRAM allocation.
- [x] 1.2 Implement raw SRAM/Flash/EEPROM import with separate hardware-window and full-image lengths; verify oversized tail preservation, short-input normalization, empty rejection, all native windows, EEPROM width 6/14 hints/overrides, unresolved width, and the misleading `realSize` value.
- [x] 1.3 Add per-core settled-write subscription, independent checkpoints, and idempotent disposal with generation guards; verify notification, hook restoration, duplicate disposal, and stale callback tests.
- [x] 1.4 Add focused integration probes against installed gbats with synthetic ROM headers; verify import, SRAM writes, Flash writes including the second bank, EEPROM serial read/write, reset loss, and reinjection for all supported capacities.

## 2. Container ownership and component contracts

- [x] 2.1 Add ROM/RAM selection revisions and preview session/result types at the existing file-state boundary; verify select/clear/reselect changes revisions and result bytes do not alias file inputs.
- [x] 2.2 Extend `RomOperationsProps` and operation/emulator events to carry launch save data, identity, checkpoints, and final output through `CartBurner → RomOperations → GBAEmulator`; update contract tests and verify no device/protocol dependencies enter the panels.
- [x] 2.3 Implement filename association choices before launch; verify case-insensitive basename matching, mismatched-name use/skip/cancel, explicit start without an invalid save, and ROM-only launch behavior.
- [x] 2.4 Implement guarded RAM result application and pending-result recovery; verify accepted changed output, unchanged output, ROM/SAV replacement under the same name, clear/reselect, busy state, deliberately unused SAV, duplicate delivery, and blocking replacement of an unresolved result.

## 3. Emulator lifecycle integration

- [x] 3.1 Pause the actual core immediately after Wrapper construction, validate/import the launch snapshot, and resume only after successful setup; verify no execution frame precedes import and invalid import pauses/disposes the partial instance without mutating source data.
- [x] 3.2 Capture stable in-game checkpoints and change status without live save-prop reimport; verify gameplay progress reaches retained session output while parent RAM data remains unchanged until accepted final writeback.
- [x] 3.3 Preserve the latest valid save during reset and same-session runtime-error retry; verify original imported data cannot overwrite newer progress, play/pause state is restored, and capacity/association metadata survives recreation.
- [x] 3.4 Implement final stable capture and pending-write close handling with a bounded 500 ms wait only for an already running core; verify settled close succeeds, paused/persistently pending close remains recoverable, and runtime failure still exposes the last valid checkpoint.
- [x] 3.5 Make close, replacement, initialization failure, and unexpected unmount dispose execution/audio/handlers idempotently and deliver results before teardown when possible; verify old timers, hooks, and asynchronous audio work cannot affect later sessions or create duplicate writeback.
- [x] 3.6 Apply the gbats ARM mode-mask compatibility before gameplay on initial construction, reset, and retry; verify real MSR SPSR/MOVS exception return across valid modes, flags/T-bit behavior, idempotence, and continued rejection of invalid modes.
- [x] 3.7 Hold GBA keyboard input until physical keyup by updating active-low keypad bits directly; verify long holds beyond gbats' auto-release interval, repeat suppression, independent combo release, and clearing on blur, hidden preview/document, pause, export, runtime/save errors, close, reset, retry, disposal, replacement, and unmount. GB/GBC input remains unchanged.

## 4. Export and local file workflow

- [x] 4.1 Add explicit raw SAV export to preview and retained-result UI using `saveBinaryFile()`, reuse the existing file-card download icon for selected RAM, and avoid a duplicate RAM operation-row download button; verify effective output bytes/name, prior pause-state restoration, pending-write checkpoint explanation, browser download wording, desktop success, cancellation, and failure/retry retention.
- [x] 4.2 Enable idle local RAM file selection, clearing, and download without a device; verify disconnected ROM/SAV preview works while cartridge read/write/verify remain disabled and busy-state file protection remains intact.
- [x] 4.3 Add association, validation, capacity, pending-save, conflict, export, and recovery messages to `zh-Hans`, `zh-Hant`, `en-US`, `ja-JP`, and `ru-RU`; use RAM consistently in user-facing file/data terminology, verify locale key parity, and render the new controls/error states without untranslated keys.

## 5. Integrated validation

- [x] 5.1 Add a container-level integration flow for selected SAV → preview → gameplay save → reset → close → RAM state → export → reimport; verify output content, core window metadata, full raw image length/tail retention, conflict recovery, and no automatic cartridge or source-disk write.
- [x] 5.2 Run focused bridge, emulator, file-state, platform-export, and operation-contract tests, then run `npm run type-check`, `npm run check:deps`, `npm run lint`, and `npm run build` in `web-client`; record results and distinguish unrelated pre-existing failures.
- [x] 5.3 Perform browser and Tauri smoke checks with legally held real-game ROM/SAV fixtures covering SRAM, Flash, and both EEPROM capacities; verify resume, in-game save, reset, export/reimport, offline use, and export cancellation, and record runtime/fixture coverage and any unavailable validation explicitly.
- [x] 5.4 Verify existing ROM-only and GB/GBC preview behavior remains usable and run `openspec validate add-gba-emulator-save-support --strict`; record regression-check results before marking implementation complete.
