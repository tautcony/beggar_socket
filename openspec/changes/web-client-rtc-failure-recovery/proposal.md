## Why

RTC command failures can leave MBC3 clocks halted or RAM mapped to RTC registers, and GBA GPIO cleanup can mask or repeat after an error. Each hardware transaction needs explicit, observable recovery while preserving rejected-input zero-I/O behavior.

## What Changes

- Run best-effort cleanup after valid RTC transactions, including capability and read operations.
- Restore the original MBC3 high/control register after interrupted writes; restore idle bank 0 with RAM disabled and latch released.
- Keep MBC3 RAM enabled until all write readback finishes.
- Attempt GBA chip-select release and GPIO disable independently, preserving the original operation error.
- Add protocol failure injection coverage and retain existing RTC input tests.

## Capabilities

### New Capabilities

- `rtc-failure-recovery`: Defined RTC hardware idle states and observable best-effort recovery after errors.

### Modified Capabilities

None.

## Impact

Only RTC base, GBA and MBC3 services, focused tests, and this change's documentation. Public RTC manager and read-result contracts stay compatible. No new hardware commands, dependencies, or value-comparison verification behavior.
