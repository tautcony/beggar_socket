# burner-settings-ui Specification

## Purpose
Expose firmware profile status and ROM read page size configuration in the advanced settings UI so users can configure read chunk sizes and understand when firmware profile changes take effect.

## Requirements

### Requirement: ROM read page size editing control
The advanced settings modal SHALL provide an editing control for `romReadPageSize` that loads the persisted setting, validates user input against configured bounds, and persists changes on save.

#### Scenario: User updates ROM read page size in advanced settings
- **WHEN** the user opens the advanced settings modal, changes the ROM read page size to a valid value, and saves settings
- **THEN** the updated `romReadPageSize` value is persisted and used by subsequent ROM read operations

#### Scenario: Invalid ROM read page size input is rejected
- **WHEN** the user enters an out-of-range or invalid ROM read page size in the advanced settings modal
- **THEN** the modal displays validation feedback and prevents saving until a valid value is entered

### Requirement: Active firmware profile display and reconnect notice
The advanced settings modal SHALL display the active connection's effective firmware profile (when connected) and clearly indicate that manual firmware profile changes apply upon reconnect or connection re-initialization.

#### Scenario: Connected device displays effective firmware profile
- **WHEN** a device is connected and the user opens the advanced settings modal
- **THEN** the firmware settings section displays the effective firmware profile bound to the current connection alongside a notice that changing the selected profile takes effect after reconnecting or re-initializing the connection

#### Scenario: Profile change does not mutate active connection immediately
- **WHEN** the user changes the firmware profile setting from STM to STC (or vice versa) while a device is connected and saves settings
- **THEN** the persisted setting is updated for future connections/re-initializations while the active connection retains its bound effective profile until reconnected or re-initialized
