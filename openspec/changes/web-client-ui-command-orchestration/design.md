## Context

Batch 4 AR-02/03 calls for reusing the existing BurnerUseCase/Facade. Device ownership already remains held until a flow ends; Vue currently mixes command preparation, cleanup and result projection.

## Goals / Non-Goals

Goals: snapshot plain selections, CFI and data at admission; preserve ROM/RAM bytes and messages; await exactly one cleanup; guard result projection against cancellation and device replacement.

Non-goals: change hardware adapters, protocol timing, file import, emulator, RTC, settings or dependencies.

## Decisions

- Add preparation methods to the existing facade backed by neutral application helpers. Copy nested CFI arrays and capture imported data buffer identity at admission: file state replaces buffers rather than mutating bytes. Allocate full data only for padding or blank verification. Retain existing command signatures for other callers.
- Add an existing-facade command transaction entry that awaits the operation and reset, preserving the primary result or thrown cause and reporting cleanup diagnostics separately. Re-export the neutral reset helper at its old composable path.
- Use runBurnerFlow onSuccess for presentation. The session composable supplies an identity and abort guard usable after awaited save dialogs. Admission precedes clearChipInfo; owner remains busy through cleanup and presentation callbacks.
- Vue keeps validation feedback, progress flags, blank-start messages, ROM parsing for export names, recent names and file-save adaptation.

## Risks / Trade-offs

- Moving cleanup before result projection changes internal ordering → preserve one reset, await it before owner release and retain reset diagnostics.
- Save dialogs can outlive a device generation → guard post-dialog logs and state with the same flow identity.
- Physical hardware remains unverified → use real port adapters with deterministic fake sessions and report the hardware limitation.

## Migration Plan

Migrate and verify ROM write first, then ROM read/verify/blank, erase, RAM commands and readCart/scan. Keep compatibility entries available; revert the scoped change to roll back.

## Validation Evidence

Validated with the explicit Node 24 runtime on 2026-10-03:

- Nine focused suites passed, 106 tests total. The three new suites contain 41 behavior tests using the real application facade/port adapter, effectScope composables and mounted CartBurner with presentation dependencies stubbed.
- Scoped ESLint passed without warnings; vue-tsc --noEmit and the AST architecture dependency check passed.
- Coverage includes short/exact/long ROM padding, captured buffer replacement, CFI/option snapshots, FF/00 blanks, loaded RAM lengths, primary and cleanup failures, awaited cleanup/projection, cancellation, replacement, disposal, late adapter callbacks, readCart admission, parser/timestamp/recent-name export rules and RAM filename selection.
- Command cleanup now completes before success presentation; owner remains held through the save dialog. Non-padding imported buffers retain their admitted identity and are not copied or mutated by preparation.
- Physical hardware and browser/Tauri smoke were not performed. This change does not claim new hardware or protocol validation.
