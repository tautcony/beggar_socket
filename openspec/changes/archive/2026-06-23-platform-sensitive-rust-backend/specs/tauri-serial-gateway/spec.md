## MODIFIED Requirements

### Requirement: TauriDeviceGateway implements DeviceGateway contract
The system SHALL provide a `TauriDeviceGateway` class in `src/platform/serial/tauri/` that implements the `DeviceGateway` interface by delegating serial lifecycle operations to the Rust native platform service layer instead of calling `tauri-plugin-serialplugin-api` directly from frontend code.

#### Scenario: List available ports
- **WHEN** `TauriDeviceGateway.list(filter?)` is called
- **THEN** it invokes the Rust serial service, converts the returned port descriptors to `SerialPortInfo[]`, and applies the optional `PortFilter` predicate

#### Scenario: Select a port
- **WHEN** `TauriDeviceGateway.select(filter?)` is called
- **THEN** it lists available ports through the Rust service, and if exactly one port matches returns it as a `DeviceSelection`, or if multiple ports match throws `PortSelectionRequiredError` with the matching ports list

#### Scenario: Connect to a selected port
- **WHEN** `TauriDeviceGateway.connect(selection)` is called with a valid port selection
- **THEN** it creates a Rust-backed serial session for the selected path, bounds the native open attempt with an application timeout, and returns a `DeviceHandle` with `platform: 'tauri'` and a `TauriSerialTransport` bound to that session

#### Scenario: Initialize a connected device
- **WHEN** `TauriDeviceGateway.init(device)` is called
- **THEN** it executes the reset signal sequence through the Rust-backed transport/session, and if any step fails it attempts to restore DTR and RTS to a safe low state before surfacing the initialization failure

#### Scenario: Disconnect a device
- **WHEN** `TauriDeviceGateway.disconnect(device)` is called
- **THEN** it attempts to close the Rust-backed session, records any close failure for callers, and still nullifies the device handle references needed to prevent stale connected state

#### Scenario: Connect without prior selection auto-selects single port
- **WHEN** `TauriDeviceGateway.connect()` is called without a selection argument
- **THEN** it lists all ports through the Rust service, and if exactly one exists it auto-connects to that port, or if zero/multiple ports exist it throws `PortSelectionRequiredError`

### Requirement: TauriSerialTransport implements Transport contract
The system SHALL provide a `TauriSerialTransport` class that implements the `Transport` interface by proxying reads, writes, and signal control to a Rust-owned serial session while preserving the buffering and mutex semantics expected by burner protocol flows.

#### Scenario: Send binary payload
- **WHEN** `TauriSerialTransport.send(payload, timeoutMs?)` is called with a `Uint8Array`
- **THEN** it sends the payload through the Rust-backed session and returns `true` on success; on failure returns `false` or throws if the timeout is exceeded

#### Scenario: Read exact byte count from session buffer
- **WHEN** `TauriSerialTransport.read(length, timeoutMs?)` is called
- **THEN** it waits until at least `length` bytes are available from the Rust-backed session buffer, returns exactly `length` bytes as `{data: Uint8Array}`, and retains any excess bytes for subsequent reads

#### Scenario: Read timeout when insufficient data
- **WHEN** `TauriSerialTransport.read(length, timeoutMs)` is called and insufficient data arrives within `timeoutMs`
- **THEN** the operation rejects with a timeout error, maintaining consistency with the existing Transport timeout contract

#### Scenario: Atomic send-and-receive operation
- **WHEN** `TauriSerialTransport.sendAndReceive(payload, readLength, sendTimeoutMs?, readTimeoutMs?)` is called
- **THEN** the operation is guarded by a mutex so concurrent callers are serialized, sends the payload through the Rust-backed session, then reads the specified length, returning `{data: Uint8Array}`

#### Scenario: Set serial control signals
- **WHEN** `TauriSerialTransport.setSignals({dataTerminalReady, requestToSend})` is called
- **THEN** it forwards the signal changes to the Rust-backed session for the specified signals

#### Scenario: Close transport
- **WHEN** `TauriSerialTransport.close()` is called
- **THEN** it closes the Rust-backed session, clears the internal receive buffer, and marks the transport as closed so subsequent operations fail predictably

### Requirement: Native port metadata is normalized for the frontend
The system SHALL convert Rust serial port descriptors into the application's `SerialPortInfo` format used by `DeviceGateway.list()`.

#### Scenario: USB port info mapping
- **WHEN** the Rust serial service returns a USB-capable port descriptor with vendor and product identifiers
- **THEN** the converted `SerialPortInfo` includes `usbVendorId` and `usbProductId` as numeric values matching the original identifiers

#### Scenario: Non-USB port info mapping
- **WHEN** the Rust serial service returns a non-USB port descriptor
- **THEN** the converted `SerialPortInfo` includes the `path` but `usbVendorId` and `usbProductId` are `undefined`

### Requirement: Tauri connection attempts are time-bounded
The system SHALL prevent Tauri serial connection attempts from hanging indefinitely when the native open path becomes unresponsive.

#### Scenario: Tauri open timeout
- **WHEN** `TauriDeviceGateway.connect()` cannot complete the native open sequence within the configured timeout window
- **THEN** the gateway fails the connect stage with a timeout-classified error and does not expose a partially initialized transport to upper layers

### Requirement: Tauri lifecycle failure recovery coverage
The system SHALL provide regression tests for Tauri-specific lifecycle failure handling.

#### Scenario: Init failure restores signal baseline
- **WHEN** Tauri gateway tests inject a failure during the reset signal sequence
- **THEN** the suite verifies the gateway attempts to restore the device signals to a low baseline before returning the failure

#### Scenario: Disconnect close failure preserves reconnectability
- **WHEN** Tauri gateway tests inject a session close failure during disconnect
- **THEN** the suite verifies the in-memory handle is cleared and a subsequent reconnect can proceed with a fresh handle

