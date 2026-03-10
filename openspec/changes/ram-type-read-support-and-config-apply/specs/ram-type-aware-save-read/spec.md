## ADDED Requirements

### Requirement: Save reads dispatch by applied RAM type
The system SHALL dispatch `/RAM/CURRENT.SAV` reads according to the applied RAM type in `current_config`.

#### Scenario: Current RAM type is SRAM
- **WHEN** the applied RAM type is `SRAM` and the host reads `/RAM/CURRENT.SAV`
- **THEN** the system uses the SRAM read path for that request

#### Scenario: Current RAM type is FRAM
- **WHEN** the applied RAM type is `FRAM` and the host reads `/RAM/CURRENT.SAV`
- **THEN** the system uses the FRAM read path for that request

#### Scenario: Current RAM type is FLASH
- **WHEN** the applied RAM type is `FLASH` and the host reads `/RAM/CURRENT.SAV`
- **THEN** the system uses the FLASH read path for that request

### Requirement: Pending RAM type does not affect save reads before apply
The system SHALL keep save reads bound to the applied RAM type until a successful apply occurs.

#### Scenario: Host changes RAM type but has not applied it
- **WHEN** `pending_config.ram_type` differs from `current_config.ram_type`
- **THEN** `/RAM/CURRENT.SAV` continues to use the `current_config.ram_type` read path
