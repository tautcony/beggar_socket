## Context

MBC3 setTime writes Halt then lacks error recovery. Its startTimer currently disables RAM before readback. Read/capability operations leave RTC mappings active. GBA cleanup is duplicated when cleanup itself rejects and capability failures can leave GPIO enabled.

## Goals / Non-Goals

Goals: best-effort idle-state recovery, original error preservation, observable cleanup errors, and unchanged input validation and public result contracts.

Non-goals: full time rollback, a new hardware protocol, value-comparison verification, or transport ownership changes.

## Decisions

- A base transaction helper runs cleanup from finally. Each independent cleanup step is attempted; errors are logged together with the operation cause. If an operation failed, its original thrown value is rethrown unchanged. Cleanup-only failure rejects with an RTCCleanupError and read/capability methods keep their existing status/boolean contracts.
- MBC3 captures register 0x0c before Halt. Existing legacy source `client/ChisFlashBurner/mission_tools.cs` documents bit 0 day-high, bit 6 Halt, bit 7 carry. Halt writes preserve these original flags. Failure after attempting Halt restores the captured high/control register, including the original Halt flag; the other four time registers can remain partially written. Success retains the newly written day-high and clears Halt/carry using the existing new-time payload.
- MBC3 cleanup releases latch, selects RAM bank 0, and disables RAM. Original bank/access state is unavailable, so the defined idle state is restored rather than guessed. RAM stays enabled until all write readback completes. Control restoration precedes mapping cleanup and selects the high register before writing it; selection failure skips the dependent write to avoid writing into the wrong register.
- GBA cleanup releases chip select with the existing CS=0/SCK=1 GPIO value, then disables GPIO. Both existing hardware writes are attempted independently. Capability probing is its own transaction and cleanup finishes before a set/read transaction begins.

## Risks / Trade-offs

- Transport failure can also reject recovery writes → best-effort cleanup logs every failure with the primary cause; hardware recovery cannot be guaranteed without a working transport.
- Interrupted setTime can partially update time → document control restoration only, never claim full rollback.
- Mock protocol tests cannot prove electrical behavior → retain existing GPIO/BCD and ordinal command sequences and use legacy register documentation.
