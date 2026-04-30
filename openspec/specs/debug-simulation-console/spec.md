## ADDED Requirements

### Requirement: Debug panel exposes simulation console sections
The system SHALL present the debug control panel as a richer simulation console with separate areas for simulation status, behavior settings, simulation data, and session actions.

#### Scenario: Panel shows simulation status summary
- **WHEN** the debug panel is opened
- **THEN** it SHALL show whether debug simulation is enabled
- **AND** it SHALL show whether a simulated device session is currently connected
- **AND** it SHALL show a summary of configured simulation resources or defaults

#### Scenario: Panel groups settings and actions by purpose
- **WHEN** the user interacts with the debug panel
- **THEN** behavior controls, memory/image controls, and session actions SHALL be presented in distinct sections rather than as one flat control list

#### Scenario: Panel exposes read and write speed controls
- **WHEN** the user configures simulated transport behavior in the panel
- **THEN** the panel SHALL allow separate control of simulated read throughput and simulated write throughput
- **AND** those settings SHALL affect subsequent simulated transport timing

### Requirement: Debug panel manages simulation images
The system SHALL allow users to load, inspect, and clear simulation images for supported simulated memory slots.

#### Scenario: User loads a simulation image
- **WHEN** the user selects a binary file for a supported simulated memory slot
- **THEN** the panel SHALL store that image in session-scoped simulation configuration
- **AND** it SHALL show the loaded file name and effective size for that slot

#### Scenario: User clears a simulation image
- **WHEN** the user clears a configured simulated memory slot
- **THEN** the panel SHALL remove the custom image for that slot
- **AND** the slot SHALL fall back to default simulated data on the next simulated session

### Requirement: Debug panel can refresh simulated session after config changes
The system SHALL provide a session action that refreshes the active simulated device session so updated simulation settings and images can take effect cleanly.

#### Scenario: Refresh simulated session
- **WHEN** the user requests a simulated-session refresh while a simulated device is connected
- **THEN** the current simulated connection SHALL be torn down cleanly
- **AND** a fresh simulated session SHALL be created using the latest simulation configuration

#### Scenario: Config changes without active simulated session
- **WHEN** the user updates simulation settings or images while no simulated device is connected
- **THEN** the new configuration SHALL be retained for the next simulated session without requiring an immediate refresh
