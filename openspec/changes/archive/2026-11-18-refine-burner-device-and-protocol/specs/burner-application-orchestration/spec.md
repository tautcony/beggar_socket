# Spec Delta

## ADDED Requirements

### Requirement: Connection-level operation ownership across all device entrypoints
All device-touching workflows on an active connection—including Burner ROM/RAM/chip operations, Cartridge Tools (RTC, rumble, PPB unlock), Debug Tools commands, and connection reset/disconnect actions—SHALL acquire a shared connection-level operation lock before communicating with the device.

#### Scenario: Concurrent entrypoint is rejected while operation is active
- **WHEN** a Burner ROM read/write/verify operation is in progress and the user triggers a Cartridge Tools action, Debug Tools command, or connection reset/disconnect
- **THEN** the secondary request is rejected with a recognizable busy outcome, does not send bytes or toggle control signals on the active connection, and provides visible feedback in the UI

#### Scenario: UI entrypoints reflect shared busy state
- **WHEN** any connection-level operation is active
- **THEN** conflicting triggers across `CartBurner`, `AppMenu` / `CartridgeToolsModal`, `DebugTools`, and `DeviceConnect` observe the shared busy state and disable conflicting actions

#### Scenario: Re-entrant nested calls reuse current ownership
- **WHEN** an active operation holding connection ownership invokes nested device steps on the same connection (such as `writeROM` -> `eraseSectors`, `verifyRAM` -> `readRAM`, batteryless save -> `eraseSectors` / `readBatterylessSave`, or PPB unlock -> `getCartInfo` / `switchROMBank`)
- **THEN** the nested calls reuse the active ownership token without deadlocking or failing the busy check

### Requirement: Cleanup completion before releasing connection ownership
Connection-level operation execution SHALL complete all cleanup actions—including command buffer reset (`resetCommandBuffer`) and restoring default 3.3V cartridge power—before releasing connection ownership and clearing busy state.

#### Scenario: Ownership held until cleanup finishes on success, failure, or cancellation
- **WHEN** an operation completes, fails, or is cancelled via `abortOperation()`
- **THEN** connection ownership remains held until command buffer reset and power restoration finish, after which ownership is released and the next operation may proceed

### Requirement: Connection lifecycle validation on operation execution
Operation contexts created for a connection SHALL capture the connection's generation or identity and SHALL reject execution if the connection has been disconnected or replaced by a reconnect.

#### Scenario: Stale session rejected after reconnect
- **WHEN** an operation context or protocol session created before disconnect/reconnect is invoked after a new connection is established
- **THEN** the operation is rejected with a stale-connection failure before touching the new device transport
