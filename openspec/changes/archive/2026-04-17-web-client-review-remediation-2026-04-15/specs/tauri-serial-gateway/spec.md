## MODIFIED Requirements

### Requirement: TauriDeviceGateway implements DeviceGateway contract
The system SHALL provide a `TauriDeviceGateway` class in `src/platform/serial/tauri/` that implements the `DeviceGateway` interface using `tauri-plugin-serialplugin-api` as the underlying serial transport.

#### Scenario: List available ports
- **WHEN** `TauriDeviceGateway.list(filter?)` is called
- **THEN** it invokes `SerialPort.available_ports()` from the serialplugin API, converts the returned `{[key: string]: PortInfo}` map to `SerialPortInfo[]` format, and applies the optional `PortFilter` predicate

#### Scenario: Select a port
- **WHEN** `TauriDeviceGateway.select(filter?)` is called
- **THEN** it lists available ports (applying filter), and if exactly one port matches returns it as a `DeviceSelection`, or if multiple ports match throws `PortSelectionRequiredError` with the matching ports list

#### Scenario: Connect to a selected port
- **WHEN** `TauriDeviceGateway.connect(selection)` is called with a valid port selection
- **THEN** it creates a `SerialPort` instance with `{path, baudRate: 9600, dataBits: Eight, parity: None, stopBits: One}`, bounds the native `open()` attempt with an application timeout, attaches the listener only after a successful open, and returns a `DeviceHandle` with `platform: 'tauri'` and a `TauriSerialTransport` instance

#### Scenario: Initialize a connected device
- **WHEN** `TauriDeviceGateway.init(device)` is called
- **THEN** it executes the reset signal sequence through `transport.setSignals()`, and if any step fails it attempts to restore DTR and RTS to a safe low state before surfacing the initialization failure

#### Scenario: Disconnect a device
- **WHEN** `TauriDeviceGateway.disconnect(device)` is called
- **THEN** it attempts `transport.close()`, records any close failure for callers, and still nullifies the device handle references needed to prevent stale connected state

#### Scenario: Connect without prior selection auto-selects single port
- **WHEN** `TauriDeviceGateway.connect()` is called without a selection argument
- **THEN** it lists all ports, and if exactly one exists it auto-connects to that port, or if zero/multiple ports exist it throws `PortSelectionRequiredError`

## ADDED Requirements

### Requirement: Tauri connection attempts are time-bounded
The system SHALL prevent Tauri serial connection attempts from hanging indefinitely when the native port open path becomes unresponsive.

#### Scenario: Tauri open timeout
- **WHEN** `TauriDeviceGateway.connect()` cannot complete `port.open()` within the configured timeout window
- **THEN** the gateway fails the connect stage with a timeout-classified error and does not expose a partially initialized transport to upper layers

### Requirement: Tauri lifecycle failure recovery coverage
The system SHALL provide regression tests for Tauri-specific lifecycle failure handling.

#### Scenario: Init failure restores signal baseline
- **WHEN** Tauri gateway tests inject a failure during the reset signal sequence
- **THEN** the suite verifies the gateway attempts to restore the device signals to a low baseline before returning the failure

#### Scenario: Disconnect close failure preserves reconnectability
- **WHEN** Tauri gateway tests inject a `transport.close()` failure during disconnect
- **THEN** the suite verifies the in-memory handle is cleared and a subsequent reconnect can proceed with a fresh handle
