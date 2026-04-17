## ADDED Requirements

### Requirement: Shared Timeout Error Constructor

A `createReadTimeoutError(metrics)` function SHALL be defined in `platform/serial/transport-errors.ts` to construct timeout error messages.

#### Scenario: Timeout error message format

WHEN `createReadTimeoutError(metrics)` is invoked with timeout metrics
THEN it SHALL return an Error with a message containing readId, expected bytes, received bytes, sessionRx, totalRx, totalTx, and elapsed time
AND the message format SHALL be identical to the pre-refactor format used in both transport implementations

#### Scenario: Web transport usage

WHEN the Web Serial transport encounters a read timeout
THEN it SHALL use `createReadTimeoutError()` instead of inline error construction

#### Scenario: Tauri transport usage

WHEN the Tauri serial transport encounters a read timeout
THEN it SHALL use `createReadTimeoutError()` instead of inline error construction

### Requirement: Shared Device Signal Initialization

An `initDeviceSignals(transport)` function SHALL be defined to encapsulate the DTR/RTS signal toggle sequence for device initialization.

#### Scenario: Signal sequence execution

WHEN `initDeviceSignals(transport)` is invoked
THEN it SHALL execute the DTR/RTS signal toggle sequence with the same timing as the pre-refactor implementations
AND the signal states and delays SHALL be identical

#### Scenario: Tauri device gateway usage

WHEN the Tauri device gateway initializes a device connection
THEN it SHALL delegate signal initialization to `initDeviceSignals()`

#### Scenario: Web device gateway usage

WHEN the Web device gateway initializes a device connection
THEN it SHALL delegate signal initialization to `initDeviceSignals()`
