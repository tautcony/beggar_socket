## MODIFIED Requirements

### Requirement: Debug settings drive simulation behavior
The system SHALL use debug settings as the source of truth for simulated-device behavior, including latency, read/write throughput, failure injection, and session-scoped simulated memory images.

#### Scenario: Simulated delay is applied at transport/runtime level
- **WHEN** debug simulation is enabled and a delay is configured
- **THEN** simulated command responses SHALL honor the configured delay without requiring adapter-specific delay helpers

#### Scenario: Simulated errors are injected into shared runtime flow
- **WHEN** debug simulation enables failure injection
- **THEN** the simulated runtime SHALL surface failures through the same gateway, transport, and protocol error paths used by hardware-backed flows

#### Scenario: Read and write throughput are controlled independently
- **WHEN** debug simulation configures distinct read and write speeds
- **THEN** simulated transport reads SHALL apply the configured read throughput
- **AND** simulated transport writes SHALL apply the configured write throughput

#### Scenario: Simulated memory images are configured in debug settings
- **WHEN** the user loads custom simulation images for supported ROM or RAM slots
- **THEN** debug settings SHALL retain those images as session-scoped simulated-device configuration
- **AND** the simulated runtime SHALL be able to consume that configuration when creating a new simulated session

### Requirement: Simulated device state is shared across burner and debug tooling
The system SHALL keep simulated ROM/RAM/device state in a shared simulated runtime so burner screens and debug tools observe the same simulated device session.

#### Scenario: Debug tool and burner flow see the same simulated memory
- **WHEN** a debug-tool command writes or reads simulated device state
- **THEN** subsequent burner operations against the same simulated session SHALL observe the updated state

#### Scenario: Reconnect creates a fresh simulated session
- **WHEN** the user disconnects and reconnects a simulated device
- **THEN** the new connection SHALL expose a fresh simulated session handle
- **AND** stale transport/session bindings from the previous connection SHALL not be reused

#### Scenario: New simulated session consumes configured images
- **WHEN** a new simulated session is established after the user configured custom simulation images
- **THEN** supported simulated ROM and RAM regions SHALL be initialized from those images with documented size clamping
- **AND** unsupported or unspecified regions SHALL continue using default simulated data
