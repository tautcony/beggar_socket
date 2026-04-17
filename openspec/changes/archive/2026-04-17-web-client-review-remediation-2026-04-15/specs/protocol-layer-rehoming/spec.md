## ADDED Requirements

### Requirement: Atomic protocol request-response sequencing
The system SHALL execute each protocol request/response exchange through one atomic transport round-trip so concurrent or future parallel protocol entrypoints cannot misassociate responses.

#### Scenario: Protocol command uses atomic send-and-receive
- **WHEN** a protocol operation sends one command and expects an acknowledgement or payload response
- **THEN** the implementation routes that exchange through the transport or adapter `sendAndReceive()` path instead of issuing separate public `sendPackage()` and `getResult()` or payload-read calls

#### Scenario: Concurrent protocol operations remain serialized
- **WHEN** two protocol operations are triggered close together against the same transport
- **THEN** their request/response pairs remain serialized and one command cannot consume the other command's response bytes

### Requirement: Structured protocol failure classification
The system SHALL classify protocol read failures with stable machine-readable metadata rather than depending exclusively on free-form error message substrings.

#### Scenario: Packet read timeout classification
- **WHEN** canonical packet-read logic fails because the expected packet does not arrive before the timeout
- **THEN** the protocol layer emits a timeout-classified failure through a stable code or error type that upper layers can inspect without parsing the rendered message

#### Scenario: Packet read length mismatch classification
- **WHEN** packet-read logic receives fewer bytes than the expected packet size
- **THEN** the protocol layer emits a length-mismatch-classified failure through a stable code or error type while preserving a human-readable diagnostic message
