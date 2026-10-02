## Context

Repository search finds no public base readROM/getCartInfo caller: GBA and MBC override both. The only live PlatformOps consumer is readROMChunkWithRetry's flash read. The legacy base template's GBA bank mapping is unsafe to reuse; live paths use planBankChunk with byte addresses, leaving word conversion to the protocol. GBA verification and both write blank sampling paths already call the same retry helper; MBC verification has its own compare/recovery loop.

## Goals / Non-Goals

**Goals:** One actual ROM read loop, one existing atomic retry entry, deterministic baseline transcripts, preserved public result/progress/error contracts and hardware policies.

**Non-Goals:** Unifying verification comparisons, CFI query, write, erase, RAM, RTC or UI operations; reducing subclasses to an arbitrary line count; changing late cancellation or throttle semantics.

## Decisions

- Move the proven GBA/MBC read loop into protected readROMWithStrategy. Public subclass entry points retain defaults and MBC firmware capability preflight, then provide bank window policy, optional switch callback, power scope, platform tracking id and throttle. Base public readROM/getCartInfo throw NotImplementedError, as other unimplemented hardware entries do.
- Keep planBankChunk as the address authority. GBA supplies full logical byte address; MBC supplies mapped bank-window address and mbcType. Use bank switch callback for initial transition and retry restoration. GBA small cartridges have no switch callback.
- Retain retry attempt logging, reset/settle, state restoration, increasing delay and final cause without introducing cancellation inside an atomic command. Preserve cancellation checks before operation and before each chunk, including successful final command when abort arrives during it.
- Active RomReadOps contains only read. Keep exported PlatformOps as deprecated legacy compatibility type, but stop constructing unused CFI/program/erase/address configuration. Keep protected helper arguments source compatible for existing subclasses.
- Keep hardware-specific getCartInfo and verify flows. MBC verification differs in compare diagnostics and reset/read retry ownership, so migrating it has no evidence-based benefit in this change.

## Risks / Trade-offs

- [Shared loop accidentally adds throttle to MBC] → Explicit MBC throttle zero, GBA configured throttle, deterministic delay transcript.
- [Hardware power scope or cleanup order changes] → Golden success/failure/cancellation transcripts include power, signals, reset and delays; use existing withOptional5v closure.
- [External users import PlatformOps] → Preserve legacy export with deprecation explanation; active adapter config no longer exposes unused fields.
- [Shared helper could be bypassed] → Tests spy the common execution and atomic retry helpers through real public reads and real write sampling.
- [No physical hardware in this run] → Preserve existing protocol shapes and run existing window/sector/simulation suites; physical timing validation remains external.

## Migration Plan

Capture focused passing baseline tests, migrate both read entries, run focused plus architecture/type/lint/spec checks, then review the independent patch. Reverting this scoped patch restores prior loops.

## Open Questions

None for this scoped migration.

## Validation Evidence

- Before production edits: deterministic transcript suite 19 tests and existing bank-window/structured-failure suites, 3 files / 47 tests passed. Those baseline expectations remained unchanged after migration.
- After migration: new transcript suite 26 tests, all adapter suites plus simulated-burner-runtime, 9 files / 95 tests passed. Existing fixtures and expected samples were not edited.
- New tests exercise actual bank register command bytes, reset/signals/drain and increasing retry delays, configured GBA throttle versus MBC zero throttle, both progress flags and cadence, final protocol cause, pre/between/final-command abort, MBC 5V success/failure/cancellation finally, MBC3 mapping, zero-size reads, shared-loop execution, GBA verification and real write blank sampling retry entry.
- Node 24.19.0 invoked explicitly from the bundled runtime. Scoped ESLint, vue-tsc --noEmit, AST dependency guard and strict OpenSpec validation passed. Source files retain LF and original BOM flags; new test/spec artifacts use LF without BOM and passed untracked whitespace checks.
- Only four service files and one new test file change production/test code; no protocol frames, hardware info flow, write/erase/verify comparison code or firmware profiles changed. Physical hardware was not available for this run.
