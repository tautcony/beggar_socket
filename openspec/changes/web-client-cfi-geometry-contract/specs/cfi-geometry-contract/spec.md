## ADDED Requirements

### Requirement: Safe complete writable geometry
The parser SHALL return false with a bounded diagnostic when device/buffer sizes are unsafe, buffer size exceeds device size, declared erase descriptors are incomplete, or erase totals differ from capacity.

#### Scenario: Unsafe or contradictory query
- **WHEN** a query declares an unsafe exponent or inconsistent erase total
- **THEN** parsing returns false before geometry is exposed to erase/write planning

#### Scenario: Complete extended descriptor table
- **WHEN** a query declares more than four complete regions covering its device
- **THEN** all regions are returned in contiguous address order with inclusive ends

#### Scenario: Truncated extended descriptor table
- **WHEN** any declared region's final accessed byte is absent
- **THEN** parsing returns false without coercing missing bytes to zero

### Requirement: Specification encoding compatibility
The parser SHALL preserve D0/D1 correction, top/bottom ordering, 128-byte zero-size encoding and existing valid simulator profiles.

#### Scenario: Datasheet geometry
- **WHEN** GL-T 64/128 MB or AL032D top/bottom query fields are parsed
- **THEN** device capacity and erase regions match their datasheets

#### Scenario: Zero encoded block size
- **WHEN** a complete descriptor encodes block size zero
- **THEN** its block size is 128 bytes

#### Scenario: Bulk-only geometry
- **WHEN** region count is zero
- **THEN** parsing retains device capacity with an empty erase block list
- **AND** existing sector planning rejects positive write/erase ranges without inventing sectors
