## Why

Simulated transfer chunks can exceed the protocol's 16-bit total frame length once command overhead is included. Simulation also accepts inconsistent packet headers and writes CRC placeholder bytes into cartridge memory, masking packets that cannot be sent to hardware.

## What Changes

- Reject payload growth and length fields that cannot be represented on the wire.
- Validate simulated command frames before execution and exclude trailing CRC bytes from writes.
- Keep simulated chunks within protocol and cartridge windows while retaining accelerated simulation.
- Add frame boundaries and 128 KiB simulated SRAM/FRAM regression coverage.

## Capabilities

### New Capabilities
- `protocol-frame-boundaries`: Enforce representable frame lengths and faithful simulated frame handling.

### Modified Capabilities

None.

## Impact

Web client payload builder, simulated runtime/transport, shared adapter chunk selection and focused tests. No native transport, connection, firmware, CRC activation, or bank planning changes.
