# Spec Delta

## ADDED Requirements

### Requirement: Atomic post-ACK flush and debug request serialization
The `Transport` contract SHALL ensure that protocol operations requiring post-ACK input flushing (`sendAndExpectAck`) and debug command send-then-receive sequences execute within the transport's exclusive critical section without releasing the lock between send, read, and buffer cleanup.

#### Scenario: Post-ACK flush cannot interleave with concurrent requests
- **WHEN** a command invokes `sendAndExpectAck` across Web, Tauri, or simulated transport
- **THEN** the send, ACK read, and post-ACK input flush complete inside a single exclusive transport lock acquisition so a subsequent request cannot start before the flush finishes

#### Scenario: Debug command uses serialized send-and-receive
- **WHEN** `executeDebugCommand` sends a debug frame and reads its response
- **THEN** it executes through the transport's serialized request-response path rather than uncoordinated separate `sendPackage` and `getPackage` calls

#### Scenario: Nested transport locking is avoided
- **WHEN** a transport executes an atomic multi-step sequence inside its mutex
- **THEN** internal steps invoke non-reentrant primitives so the transport never deadlocks on its own lock

#### Scenario: Runtime parity across Web, Tauri, and simulated transports
- **WHEN** atomic post-ACK flush and debug request tests run against Web, Tauri, and simulated transport implementations
- **THEN** all three implementations enforce equivalent mutual exclusion and buffer cleanup semantics
