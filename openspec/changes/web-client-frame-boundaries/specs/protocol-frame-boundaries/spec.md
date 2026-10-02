## ADDED Requirements

### Requirement: Representable command frames
The builder SHALL reject total frame sizes above 65535 and unsigned 16-bit lengths outside their range before emitting a packet, while preserving valid frame bytes and optional CRC behavior.

#### Scenario: Maximum frame and overflow
- **WHEN** a command body yields 65535 total bytes or one additional byte
- **THEN** the maximum frame is accepted and the larger frame is rejected

### Requirement: Faithful simulated packet handling
Simulation SHALL reject mismatched declared sizes, invalid command headers and incomplete layouts, and SHALL exclude the trailing two CRC bytes from cartridge write data.

#### Scenario: Invalid header
- **WHEN** simulation receives a declared length different from the actual frame
- **THEN** it rejects the frame before changing cartridge memory

#### Scenario: CRC trailer excluded
- **WHEN** simulation executes a valid direct, FRAM or program write
- **THEN** only the command data bytes are written

### Requirement: Legal accelerated chunks
Simulated adapters SHALL use transfer chunks that fit frame overhead and the smallest supported cartridge bank window without enabling CRC or changing native transfer sizes.

#### Scenario: Large simulated save
- **WHEN** 128 KiB SRAM or FRAM is transferred with aligned bank planning
- **THEN** every frame has a representable total length and data round trips correctly
