# Design

## Context

Burning stack: `CartBurner.vue` → `BurnerUseCaseImpl` → `CartridgeProtocolPortAdapter` → `GBAAdapter`/`MBC5Adapter` → `protocol/beggar_socket/` → `Transport`. Commands are already serialized per device, and sector-scoped write recovery exists.

Device-side facts that constrain the client (verified in `mcu/chis_flash_burner/Core/Src/uart.c`, `stc/src/uart.c`, and RC31 `sdcc_*_flashgbx_rc31/src/uart.c`, `flashgbx.c`):

| Fact | Source | Client consequence |
|---|---|---|
| F4/FC `romProgram` slices the frame into `bufferSize` write-buffer ops starting at the frame address; no page-boundary handling | STM `uart.c:411`, RC31 `uart.c:679` | Each chunk must start on a write-buffer page boundary, or the buffer op straddles pages and fails |
| `romWaitForDone` polls DQ7 with no timeout; only a control-line change (`cmdEnd`) aborts it | RC31 `uart.c:582`, `uart_setControlLine` | Programming onto unerased flash hangs the device until host timeout + DTR/RTS pulse (already done by `resetCommandBuffer`) |
| F6 read: STM copies into `responBuf[5500]`; STC/RC31 stream 62B packets with uint16 count | STM `uart.c:520`, RC31 `uart.c:896` | Read chunk may exceed 4 KiB on STC/RC31 only |
| Receive buffer `cmdBuf[5500]` | all firmwares | Write chunk stays ≤ 4 KiB |
| RC31 enters FlashGBX mode when first byte ≥ `0xA0` or `== 0x55`; legacy first byte is frame-length low byte | RC31 `flashgbx.c` `flashgbx_mark_receive` | Legacy frame lengths must avoid those low bytes; power-of-two chunks ≥ 64B always do (`n+11` low byte ∈ {`0x0B`,`0x4B`,`0x8B`}) |
| Erase is host-driven (6× F5 + F6 polling); F3 is not implemented on STC/RC31 | RC31 `uart.c:497` | Duplicate erase of the same physical sector costs a full erase time |

## Goals / Non-Goals

**Goals**
- Correct physical erase set and a single chunk planner whose output is valid for every firmware by construction.
- Write and verify operate on the same image and range.
- Remove pure overhead: duplicate erases, programming already-erased bytes, small read requests on streaming firmwares.
- Cancellation never lets two operations interleave on one transport.
- Allow RC31 devices to connect through the existing legacy path.

**Non-Goals**
- Firmware changes; FlashGBX session (`C1`/`D5`/`CA`) — separate change.
- Runtime rejection layers in the protocol wrapper, CFI command-set / MBC capability gating, partial-sector read-modify-write, explicit prefix-verify mode.

## Decisions

### 1. Physical sector intersection
`calcSectorUsage(blocks, size, baseAddress)` enumerates physical sectors from each block's absolute `startAddress` and returns those intersecting `[baseAddress, baseAddress+size)`, merged into `SectorBlock` runs. It throws only if `baseAddress + size > deviceSize` (writing past the end wraps the bus address and overwrites the chip start — this is the existing "insufficient space" check, corrected to include `baseAddress`).
Partial head/tail coverage is not rejected: the whole sector is erased as today, and a single warn log states the extra erased range.
*Why not reject*: UI presets are sector-aligned; rejection adds a failure mode without improving the normal path.

### 2. One chunk planner for read, write, verify
`nextChunkSize({ address, remaining, pageSize, bankSize, sectorEnd?, bufferSize? })` in `utils/transfer-plan.ts`:
- `end = min(alignUp(address + 1, align), address + remaining, bankEnd, sectorEnd)`, where `align = pageSize`, or `bufferSize` when `address` is not `bufferSize`-aligned.
- `pageSize` is normalized down to a power of two (settings validator and `resolveRomPageSize`), replacing the current warn-only path.
With power-of-two page sizes, bank windows (32 MiB / 16 KiB) and sector boundaries are page multiples, so chunks never straddle them; frame lengths stay RC31-safe.
*Alternative*: per-loop inline `Math.min` (current) — rejected, it already diverged between write and verify.

### 3. Same image for write and verify, inside the adapter
`prepareRomImage(data, size)` returns `data` when long enough, otherwise a copy padded with `0xFF`. Called in `GBAAdapter`/`MBC5Adapter` `writeROM` and `verifyROM` (UI padding in `CartBurner.vue` reuses it). `verifyROM` checks `[baseAddress, baseAddress+size)` against that image (clamped to device size, as now). `written` advances by the actual chunk length.
*Why in the adapter*: one place guarantees parity for UI and direct callers; no separate pre-validation helper needed.

### 4. Skip erased-state chunks
After a successful erase (initial or recovery), a chunk whose bytes are all `0xFF` is not sent; it advances `written`, is counted as `skippedBytes`, and is excluded from transfer-speed samples. Verify still reads it.
*Why safe*: sector erase leaves `0xFF`; programming `0xFF` is a no-op on NOR flash.

### 5. Profile-aware read chunk size
New setting `romReadPageSize` (default = current `romPageSize`, i.e. no behavior change). Effective read chunk = `min(romReadPageSize, profile.maxReadChunk)`, with `maxReadChunk` = 4 KiB for `stm`/`unknown`, 32 KiB for `stc`. Used by `readROM`/`verifyROM` only; the planner still clamps to bank windows (so MBC reads stay ≤ 16 KiB). Default changes only after hardware A/B (task 4.3).

### 6. Recovery replay start
`written = max(sector.address, baseAddress) - baseAddress` after re-erase; replay uses the same padded image and the same skip rule.

### 7. Cancellation keeps the lock
`BurnerSession.abortOperation()` only aborts the signal and marks a `cancelling` state; `busy` is cleared by `completeOperation()` when the operation's promise settles. `runWithTimeout()` aborts the signal on timeout and still waits for the operation before releasing. UI shows cancelling and disables new operations meanwhile.

### 8. RC31 legacy discovery
Add `{ vendorId: 0x0483, productId: 0x5740 }` to `PortFilters.presets.beggarSocket`; `inferFirmwareProfileFromPort` maps `0483:5740` to `STC_FIRMWARE_PROFILE` (RC31 is the STC8H firmware with the legacy command set preserved). Frame-length compatibility comes from Decision 2; no extra guard.

## Relation to the analysis

| Analysis item | Treatment |
|---|---|
| P1 physical sector intersection | Kept (Decision 1); partial coverage warn instead of reject |
| P1 pre-erase input contract | Reduced to adapter-internal padding + corrected capacity check |
| P1 actual completion accounting | Kept (Decision 3) |
| P1 write/verify same image | Kept; prefix-verify mode dropped |
| P1 shared bank chunking | Kept and extended with write-buffer alignment (from firmware `romProgram`) |
| P1 protocol frame checks | Runtime checks dropped; byte-level regression tests only |
| P1 CFI command set / MBC gating | Dropped (would reject working `0x89` cards; MBC1/2 already fail before erase) |
| P2 recovery, cancel, timing | Kept; cancel fix targets the concrete `busy=false` race |
| Optional RC31 | Discovery kept; FlashGBX session deferred |
| Not in analysis | Added: `0xFF` chunk skip, profile-aware read chunk size |

## Risks / Trade-offs

- **Existing tests assume old `calcSectorUsage` output** → update fixtures to physical addresses; aligned base-0 cases are unchanged.
- **Larger read chunks on a slow STC board exceed `packageReceiveTimeout`** → default unchanged; cap 32 KiB (~0.1–0.3 s at observed rates); enabled only after A/B.
- **0xFF skip hides a failed erase** → verify still covers skipped ranges; erase polling already requires `0xFF` at the sector start.
- **0483:5740 is a generic STM32 VCP PID** → only widens the chooser; wrong device fails at CFI/ID read as any unknown device does today.
