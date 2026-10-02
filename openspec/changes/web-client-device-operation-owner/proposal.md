## Why

Independent burner panels, cartridge tools and debug requests can interleave on the same transport. Disconnect can close a transport before a worker and its reset have settled.

## What Changes

- Own complete device operations by transport identity and reject overlap.
- Drain active operations before closing a connection, including automatic reconnect.
- Bind adapter callbacks and activity checks to their original connection.

## Capabilities

### New Capabilities
- `device-operation-owner`: Exclusive complete operations and connection draining.

### Modified Capabilities

None.

## Impact

Burner application ownership, container session state, cartridge tools, debug service and gateway connection adapter. No protocol or native changes.
