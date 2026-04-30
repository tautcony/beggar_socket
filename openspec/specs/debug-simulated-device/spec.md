## Purpose

Define requirements for the debug-mode simulated device runtime so simulation behavior is configurable, shared across tooling, and exercised through the burner workflow.
## Requirements
### Requirement: Debug settings drive simulation behavior
The system SHALL use debug settings as the source of truth for simulated-device behavior, including latency and failure injection.

#### Scenario: Simulated delay is applied at transport/runtime level
- **WHEN** debug simulation is enabled and a delay is configured
- **THEN** simulated command responses SHALL honor the configured delay without requiring adapter-specific delay helpers

#### Scenario: Simulated errors are injected into shared runtime flow
- **WHEN** debug simulation enables failure injection
- **THEN** the simulated runtime SHALL surface failures through the same gateway, transport, and protocol error paths used by hardware-backed flows

### Requirement: Simulated device state is shared across burner and debug tooling
The system SHALL keep simulated ROM/RAM/device state in a shared simulated runtime so burner screens and debug tools observe the same simulated device session.

#### Scenario: Debug tool and burner flow see the same simulated memory
- **WHEN** a debug-tool command writes or reads simulated device state
- **THEN** subsequent burner operations against the same simulated session SHALL observe the updated state

#### Scenario: Reconnect creates a fresh simulated session
- **WHEN** the user disconnects and reconnects a simulated device
- **THEN** the new connection SHALL expose a fresh simulated session handle
- **AND** stale transport/session bindings from the previous connection SHALL not be reused

### Requirement: Debug mode provides a simulated device runtime
The system SHALL expose debug-mode device simulation through the shared connection lifecycle instead of bypassing connection and burner runtime code with a dedicated mock adapter.

#### Scenario: Debug connection yields a simulated device handle
- **WHEN** debug simulation is enabled and the user connects a device
- **THEN** the connection flow SHALL return a connected simulated device handle through the normal connection orchestration path
- **AND** upper layers SHALL receive a normal `DeviceInfo` backed by a simulated transport rather than a fabricated adapter-only mock

#### Scenario: Burner operations use production adapters in debug mode
- **WHEN** a simulated device is connected in debug mode
- **THEN** burner actions SHALL execute through the real `GBAAdapter` or `MBC5Adapter`
- **AND** protocol requests SHALL pass through the shared protocol and transport helpers used by hardware-backed sessions

