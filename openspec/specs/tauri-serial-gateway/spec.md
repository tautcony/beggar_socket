## Purpose

Define the Tauri-native serial gateway and transport requirements so burner protocol flows can use `tauri-plugin-serialplugin-api` through the shared device/transport abstractions.

## Requirements

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
- **THEN** it creates a `SerialPort` instance with `{path, baudRate: 9600, dataBits: Eight, parity: None, stopBits: One}`, calls `port.open()` and `port.startListening()`, registers a binary data listener via `port.listen(callback, false)`, and returns a `DeviceHandle` with `platform: 'tauri'` and a `TauriSerialTransport` instance

#### Scenario: Initialize a connected device
- **WHEN** `TauriDeviceGateway.init(device)` is called
- **THEN** it sets DTR and RTS signals to `false` via `transport.setSignals()`, waits 10ms, then sets both to `true`, and waits 200ms - matching the existing reset sequence

#### Scenario: Disconnect a device
- **WHEN** `TauriDeviceGateway.disconnect(device)` is called
- **THEN** it calls `transport.close()` which cancels listening and closes the serial port, and nullifies the device handle references

#### Scenario: Connect without prior selection auto-selects single port
- **WHEN** `TauriDeviceGateway.connect()` is called without a selection argument
- **THEN** it lists all ports, and if exactly one exists it auto-connects to that port, or if zero/multiple ports exist it throws `PortSelectionRequiredError`

### Requirement: TauriSerialTransport implements Transport contract
The system SHALL provide a `TauriSerialTransport` class that implements the `Transport` interface, wrapping a `SerialPort` instance from `tauri-plugin-serialplugin-api` with an internal receive buffer for accumulated data.

#### Scenario: Send binary payload
- **WHEN** `TauriSerialTransport.send(payload, timeoutMs?)` is called with a `Uint8Array`
- **THEN** it calls `port.writeBinary(payload)` and returns `true` on success; on failure returns `false` or throws if the timeout is exceeded

#### Scenario: Read exact byte count from buffer
- **WHEN** `TauriSerialTransport.read(length, timeoutMs?)` is called
- **THEN** it waits until at least `length` bytes are available in the internal receive buffer (populated by the serialplugin `listen` callback), returns exactly `length` bytes as `{data: Uint8Array}`, and retains any excess bytes in the buffer for subsequent reads

#### Scenario: Read timeout when insufficient data
- **WHEN** `TauriSerialTransport.read(length, timeoutMs)` is called and insufficient data arrives within `timeoutMs`
- **THEN** the operation rejects with a timeout error, maintaining consistency with the existing Transport timeout contract

#### Scenario: Atomic send-and-receive operation
- **WHEN** `TauriSerialTransport.sendAndReceive(payload, readLength, sendTimeoutMs?, readTimeoutMs?)` is called
- **THEN** the operation is guarded by a mutex so concurrent callers are serialized, sends the payload, then reads the specified length, returning `{data: Uint8Array}`

#### Scenario: Set serial control signals
- **WHEN** `TauriSerialTransport.setSignals({dataTerminalReady, requestToSend})` is called
- **THEN** it calls `port.writeDataTerminalReady(dtr)` and/or `port.writeRequestToSend(rts)` for each signal specified in the input

#### Scenario: Close transport
- **WHEN** `TauriSerialTransport.close()` is called
- **THEN** it calls `port.cancelListen()` then `port.close()`, clears the internal receive buffer, and marks the transport as closed so subsequent operations fail predictably

### Requirement: Serialplugin PortInfo to SerialPortInfo conversion
The system SHALL convert `tauri-plugin-serialplugin-api`'s `PortInfo` format (map of path -> info with `port_type`, `vid`, `pid`, `manufacturer`, `serial_number`) to the application's `SerialPortInfo` format used by `DeviceGateway.list()`.

#### Scenario: USB port info mapping
- **WHEN** serialplugin returns a port with `port_type: "UsbPort"` and `vid`/`pid` fields
- **THEN** the converted `SerialPortInfo` includes `usbVendorId` and `usbProductId` as numeric values matching the original VID/PID

#### Scenario: Non-USB port info mapping
- **WHEN** serialplugin returns a port with `port_type: "PciPort"` or `"Unknown"`
- **THEN** the converted `SerialPortInfo` includes the `path` but `usbVendorId` and `usbProductId` are `undefined`
