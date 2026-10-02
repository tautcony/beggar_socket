## ADDED Requirements

### Requirement: Fixed reservations fit cartridge geometry
The builder SHALL reject invalid cartridge geometry, menu/list/status layouts beyond flash, minimum ROM sizes that cannot encode complete menu blocks, and item lists larger than their reserved sector.

#### Scenario: Unsafe configuration
- **WHEN** cartridge type zero, a fractional type, a 64 KiB minimum size, or an oversized menu is configured
- **THEN** the build fails with an explicit boundary error

#### Scenario: Item list boundary
- **WHEN** serialized allocated entries exceed one list sector
- **THEN** encoding fails before overwriting status or save bytes

### Requirement: Save slots preserve independent reservations
The builder SHALL treat slot zero as no save and validate one-based slots against flash capacity and the serialized byte. It SHALL reserve valid save slots even without an imported file and preserve the first imported save for shared slots.

#### Scenario: No-save slot
- **WHEN** a battery-backed game has slot zero
- **THEN** status bytes are preserved and its entry encodes save type zero

#### Scenario: Missing shared save
- **WHEN** games share a valid slot and no save is available for a later game
- **THEN** the existing save bytes and reserved allocation boundary are preserved

### Requirement: ROM allocation uses complete logical spans
The allocator SHALL allocate only when the entire logical ROM span fits available flash sectors, and SHALL retain the existing skip log and omit unallocated games from menu metadata.

#### Scenario: Short physical file at flash tail
- **WHEN** the physical ROM bytes fit but the logical padded size exceeds the flash tail
- **THEN** the game is skipped and no ROM reservation or menu entry is added

#### Scenario: Valid fixed build
- **WHEN** the existing fixed-time valid fixture is built
- **THEN** ROM, save, title, key grouping, code, and checksum bytes remain identical
