## Context

Frames contain a two-byte total size, a command-specific body and two CRC bytes. Direct writes have nine bytes of overhead, FRAM writes ten, and program writes eleven. Current simulation selects 65533-byte chunks and includes CRC bytes in write data. Firmware profiles expose capabilities rather than transfer length limits; cartridge windows are 16 KiB MBC5 ROM and 8 KiB MBC5 RAM.

## Goals / Non-Goals

**Goals:** Reject frame overflow before mutation or sending; preserve golden bytes and disabled CRC behavior; validate simulation headers and exact command layouts; retain accelerated chunks within the smallest cartridge window.

**Non-Goals:** Native transport changes, CRC activation, adapter bank planning, firmware changes or per-profile tuning.

## Decisions

- Enforce the 65535-byte frame bound centrally in PayloadBuilder and validate unsigned 16-bit length fields. This covers every write layout without duplicating command guards.
- Validate size/header and command layout in simulated execution, shared by direct runtime and transport callers. Slice write data before the two-byte trailer. Do not validate CRC while firmware leaves it optional.
- Use 8 KiB aligned simulated chunks. This retains larger chunks than the configured 4 KiB default, fits the smallest MBC5 window, and prevents impossible frames. Bank-edge splitting remains a separate change.

## Risks / Trade-offs

- More simulated commands than the old invalid 65533-byte chunk → keep throughput controls and larger chunks than hardware defaults.
- Existing simulator fixtures may rely on permissive frames → use actual protocol builders and test malformed headers separately.
- Arbitrary starting addresses can still cross banks → follow-up bank planning must cap chunks to remaining window bytes.
