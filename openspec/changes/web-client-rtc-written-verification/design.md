## Context

Both RTC implementations log five reads regardless of their values. Input snapshots and independent cleanup already exist. Public readTime contracts and hardware sessions must remain intact.

## Goals / Non-Goals

**Goals:** Fail observably for ignored/mismatched writes; accept ordinary clock ticks; preserve recovery.

**Non-Goals:** Change public input ranges, firmware, or public readTime decoding; prove physical hardware behavior.

## Decisions

- BaseRTC owns a bounded five-attempt comparison loop, with 500 ms between mismatches and immediate return on first match. Transport exceptions propagate immediately to preserve their identity and fault recovery. Invalid snapshots are mismatches. Remove unused verifyTimeSet methods after caller search.
- Capture performance.now before/after the final time write. For each read, accept integer increments from max(0, floor(elapsed since write completion)-1) through ceil(elapsed since write start)+1. One second accommodates clock phase/whole-second precision. Use the snapshot acquisition point, excluding serial read duration after latching. Clock references must be finite, nonnegative, ordered, and at most Number.MAX_SAFE_INTEGER milliseconds; compare wrapping integer deltas mathematically without per-second iteration. No wall clock or timezone dependence; reject backwards target increments. GBA retains its existing one-second settle.
- GBA reads status and all seven bytes in the existing GPIO session, releases CS between transactions, rejects POWER/test flags, unsupported status bits, bad BCD/ranges, and non-24-hour mode. Set 24-hour status when needed before writing. Ignore the hour AM/PM flag in 24-hour mode as specified. Compare UTC calendar advancement with year modulo 100 and independently supplied weekday modulo 7. 99-12-31 advances to 00-01-01; calendar semantics beyond this boundary are not extended.
- MBC3 explicitly writes 0 then 1 for every coherent latch. Verify five registers with access enabled, release latch in finally, and compare the raw 512-day counter modulo 512 plus expected carry. Halt must be clear. Input ordinal ranges remain unchanged; hardware day advancement is not ordinal/year wrap. Capture write reference around the final high register write that resumes counting.
- Every verification failure flows through existing outer cleanup and MBC3 high/control restoration; do not pretend to restore partially written time fields.

Sources: [Seiko S-3511A datasheet](https://www.rockby.com.au/DSheets/10110.pdf), real-time/status register descriptions and write correction (pages 7-12); [Nintendo Game Boy Programming Manual](https://thissideout.wordpress.com/wp-content/uploads/2014/02/gameboyprogrammingmanual.pdf), MBC3 clock registers/latching.

## Risks / Trade-offs

- Already-matching hardware cannot reveal an ignored write; equality proves readable target state, not write acceptance or future ticking. Unchanged old values outside the target window fail.
- A bounded attempt count does not add a transport timeout; command timeouts remain the transport's responsibility.
- Protocol models exercise cleanup and encoding but do not replace hardware testing. Readback tolerance grows with actual monotonic serial time, not an unbounded retry allowance.

## Validation

- Initial focused regression run: 21 failed / 8 passed, demonstrating log-only verification did not compare the supplied target.
- Final RTC suite: 239 passed across 3 files (197 existing input/recovery cases and 42 written-verification cases).
- Scoped ESLint for the three RTC services and three RTC test files: passed.
- vue-tsc --noEmit: passed. OpenSpec strict validation: passed.
- Existing recovery matrices still inject failure at every baseline protocol command. Newly independent snapshot-release cleanup failures assert RTCCleanupError containing the original cause; operation failures still assert original exception identity. All original control/idle assertions remain.
- No physical cartridge tests were performed. No production build was needed for these service-only changes.
