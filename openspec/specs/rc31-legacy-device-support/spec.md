# rc31-legacy-device-support Specification

## Purpose
Defines how RC31 devices are discovered and driven through the existing legacy protocol.

## Requirements

### Requirement: RC31 legacy discovery
The system SHALL include USB `0483:5740` in the product serial-port filter and SHALL infer the STC firmware profile for it, using the existing legacy command set without FlashGBX commands.

#### Scenario: RC31 port is selectable and uses STC profile
- **WHEN** a serial port with vendor `0x0483` and product `0x5740` is listed
- **THEN** it passes the `beggarSocket` filter and `inferFirmwareProfileFromPort` returns the STC profile

#### Scenario: Existing devices unchanged
- **WHEN** a `0483:0721` device is listed
- **THEN** filtering and profile inference behave as before

### Requirement: Legacy frame lengths compatible with RC31 first-byte dispatch
Legacy frames produced by ROM and RAM transfer planning SHALL have a frame-length low byte that is neither `>= 0xA0` nor `0x55`, which the unified chunk planner guarantees by using power-of-two chunk sizes of at least 64 bytes.

#### Scenario: Normalized page sizes produce safe F4 frames
- **WHEN** F4 frames are built for each normalized page size from 64 B to 4 KiB
- **THEN** every frame-length low byte is outside `>= 0xA0` and `0x55`
