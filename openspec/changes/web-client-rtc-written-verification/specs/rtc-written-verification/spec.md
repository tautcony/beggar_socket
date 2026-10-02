## ADDED Requirements

### Requirement: Written time is compared with the target

setTime SHALL resolve only after a valid coherent snapshot matches the copied typed target plus a nonnegative integer elapsed-time increment. It SHALL try at most five snapshots with 500 ms between mismatches, return on first match, and throw an RTC verification error after exhaustion. Transport read errors SHALL propagate immediately.

#### Scenario: Ignored write
- **WHEN** readback remains an old time outside the allowed target window
- **THEN** setTime rejects after bounded attempts

#### Scenario: Delayed match
- **WHEN** an initial mismatch is followed by valid matching readback
- **THEN** setTime resolves at that matching attempt

### Requirement: Hardware ticking and rollover are explicit

Verification SHALL use monotonic references around the final write and allow whole-second uncertainty of one second. GBA SHALL compare valid BCD calendar and weekday advancement, including month/year and 99 to 00 rollover. MBC3 SHALL compare its raw nine-bit day counter modulo 512 and carry, reject Halt, and not wrap at calendar year end.

#### Scenario: Calendar carry
- **WHEN** GBA crosses midnight at month/year end during verification
- **THEN** the advanced calendar and independently supplied weekday are accepted

#### Scenario: Counter carry
- **WHEN** MBC3 advances from day 511 to day 0
- **THEN** verification accepts only matching time with carry set

### Requirement: Verification retains session and cleanup

GBA SHALL verify status/time inside the existing GPIO session with no public readTime call or GPIO restart. MBC3 SHALL keep access enabled and latch each snapshot via zero-to-one transition, releasing it on all outcomes. Invalid BCD/status, unexpected Halt, and mismatches SHALL not report success. Outer cleanup SHALL preserve primary errors, attempt independent cleanup steps, and restore original MBC3 control after verification failure.

#### Scenario: Read failure
- **WHEN** verification throws while reading a snapshot
- **THEN** the original error propagates and all applicable session cleanup/control restoration is attempted

#### Scenario: Invalid input
- **WHEN** input validation fails
- **THEN** no protocol I/O or cleanup occurs and the caller input remains unchanged
