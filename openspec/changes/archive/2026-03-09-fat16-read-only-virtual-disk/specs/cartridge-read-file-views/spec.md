## ADDED Requirements

### Requirement: ROM content is exposed as a read-only virtual file window
The system SHALL expose the current cartridge ROM contents through `/ROM/CURRENT.GBA` as a read-only virtual file whose file offsets map deterministically to ROM read addresses.

#### Scenario: Host reads from CURRENT.GBA
- **WHEN** the host reads a byte range from `/ROM/CURRENT.GBA`
- **THEN** the device returns bytes from the corresponding ROM address range derived from the file offset

#### Scenario: Host reads sequential ROM sectors
- **WHEN** the host performs sequential reads across adjacent sectors of `/ROM/CURRENT.GBA`
- **THEN** each returned sector reflects the next contiguous ROM address range

#### Scenario: Host attempts to write CURRENT.GBA
- **WHEN** the host writes to `/ROM/CURRENT.GBA`
- **THEN** the device rejects the write or preserves read-only semantics without altering cartridge data

### Requirement: Save content is exposed as a read-only virtual file window
The system SHALL expose the current cartridge save contents through `/RAM/CURRENT.SAV` as a read-only virtual file whose file offsets map deterministically to save-memory read addresses.

#### Scenario: Host reads from CURRENT.SAV
- **WHEN** the host reads a byte range from `/RAM/CURRENT.SAV`
- **THEN** the device returns bytes from the corresponding save-memory address range derived from the file offset

#### Scenario: Host reads sequential save sectors
- **WHEN** the host performs sequential reads across adjacent sectors of `/RAM/CURRENT.SAV`
- **THEN** each returned sector reflects the next contiguous save-memory address range

#### Scenario: Host attempts to write CURRENT.SAV
- **WHEN** the host writes to `/RAM/CURRENT.SAV`
- **THEN** the device rejects the write or preserves read-only semantics without altering cartridge save data

### Requirement: Read-only file windows expose firmware-derived file size
The system SHALL expose `/ROM/CURRENT.GBA` and `/RAM/CURRENT.SAV` with file sizes derived from firmware-known cartridge metadata or configured read window limits.

#### Scenario: Host inspects CURRENT.GBA size
- **WHEN** the host reads the directory entry for `/ROM/CURRENT.GBA`
- **THEN** the reported file size matches the ROM window size presented by the firmware

#### Scenario: Host inspects CURRENT.SAV size
- **WHEN** the host reads the directory entry for `/RAM/CURRENT.SAV`
- **THEN** the reported file size matches the save window size presented by the firmware

### Requirement: Read-only file views are backed by cartridge service abstractions
The system SHALL serve `/ROM/CURRENT.GBA` and `/RAM/CURRENT.SAV` through firmware read-service abstractions rather than direct protocol-layer command handlers.

#### Scenario: ROM file view executes a read
- **WHEN** firmware handles a host read for `/ROM/CURRENT.GBA`
- **THEN** the file view invokes a ROM read-service abstraction that is independent from USB CDC command parsing

#### Scenario: SAV file view executes a read
- **WHEN** firmware handles a host read for `/RAM/CURRENT.SAV`
- **THEN** the file view invokes a save read-service abstraction that is independent from USB CDC command parsing

#### Scenario: Host updates MODE.TXT and re-reads CURRENT.GBA size
- **WHEN** the host writes new `BASE_ADDRESS` and `SIZE` values to `/ROM/MODE.TXT` and then reads the directory entry for `/ROM/CURRENT.GBA`
- **THEN** the reported file size matches the updated ROM export window

#### Scenario: ROM file view uses configured export base address
- **WHEN** firmware handles a host read for `/ROM/CURRENT.GBA` after `MODE.TXT` configured a non-zero `BASE_ADDRESS`
- **THEN** the file view invokes the ROM read-service abstraction using `BASE_ADDRESS + file_offset`
