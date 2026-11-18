# Spec Delta

## ADDED Requirements

### Requirement: Single authoritative connection context state
Connection orchestration SHALL maintain a single authoritative connection context holding `transport`, `portInfo`, effective `firmwareProfile`, and connection `generation`/identity, eliminating duplicated mutable copies across `DeviceInfo` and `serialHandle` and inconsistent fallback reads.

#### Scenario: Port info update preserves effective firmware profile
- **WHEN** `withPortInfo()` updates port metadata during connection setup
- **THEN** it updates only port metadata and does not overwrite the connection's resolved manual `firmwareProfile`

#### Scenario: Effective firmware profile fixed for connection and operation lifetime
- **WHEN** a connection is initialized with a resolved manual `firmwareProfile`
- **THEN** all operations on that connection read the same authoritative `firmwareProfile`, and modifying `AdvancedSettings.firmwareProfile` in settings does not alter the active connection's profile until reconnect or re-initialization

#### Scenario: Disconnect clears active transport and connection identity
- **WHEN** a device is disconnected
- **THEN** the authoritative connection context clears active transport and connection handles and invalidates the prior connection generation so subsequent stale reads or operations fail deterministically
