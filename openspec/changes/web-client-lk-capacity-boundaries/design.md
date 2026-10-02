## Context

Supported cartridges have 64/128/256/512 MiB flash, 128/256 KiB sectors, and 512 KiB blocks. The GUI fixes the minimum ROM size to 4 MiB and exposes fonts 1/2 and one-based save slots; CLI configuration can provide other values. updateSectorMap uppercases the first reservation sector, so uppercase S lookup is correct. The actual save-end problem is conditioning it on imported files.

## Goals / Non-Goals

**Goals:** Validate complete logical reservations, preserve shared saves and valid binary output, reject unsafe metadata/configuration.

**Non-Goals:** Menu format changes, image performance, UI, RTC, native, sector planning outside LK.

## Decisions

- Keep fixed one-sector list and status geometry. Supported 4 MiB minimum configurations have at most 127 allocated games and cannot overflow list capacity. Check actual encoded entries anyway at the public boundary; do not assume menu firmware supports multiple list sectors.
- Treat slot zero as no save. One-based slots up to 256 must fit flash and the serialized byte. Shared slots retain first imported save semantics; initialize once while allowing the first later available import.
- Derive save end from reservations, not imports. Require complete allocation spans and retain logging/skipping for games that cannot fit.
- Validate power-of-two minimum ROM sizes of at least the 512 KiB menu block granularity. 64 KiB inputs are valid files padded to the configured minimum; 64 KiB minimum sizes cannot encode a nonzero menu block count.
- Use exported compatibility helpers and temporary restored cartridge geometry for low-memory fixtures, with no production test switches.

## Risks / Trade-offs

- Previously accepted malformed configuration will throw explicit errors. Valid GUI configuration and fixed golden bytes remain unchanged.
- Multi-sector item lists are undocumented; fail safely rather than relocate status/save data.
