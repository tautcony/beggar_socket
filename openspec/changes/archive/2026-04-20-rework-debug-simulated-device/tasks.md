## 1. Simulated Runtime Foundation

- [x] 1.1 Add simulated serial runtime modules under `src/platform/serial/simulated` for shared session state, memory/image initialization, and protocol command handling
- [x] 1.2 Implement `SimulatedTransport` and `SimulatedDeviceGateway` that satisfy the shared transport/gateway contracts and expose a `simulated` device handle
- [x] 1.3 Update serial platform types and factory wiring so gateway selection prefers simulated runtime when debug simulation is enabled

## 2. Runtime Integration

- [x] 2.1 Refactor `DebugSettings` from adapter-only helpers into simulation configuration/state used by the simulated runtime
- [x] 2.2 Update `DeviceConnectionManager` to connect and initialize through the simulated gateway instead of returning fabricated mock `DeviceInfo`
- [x] 2.3 Update `CartBurner.vue` to always use real `GBAAdapter` and `MBC5Adapter` sessions for connected devices, including simulated ones

## 3. UI And Cleanup

- [x] 3.1 Rework debug panel behavior and copy so controls manage simulated-device runtime settings rather than `MockAdapter` shortcuts
- [x] 3.2 Remove `MockAdapter` from runtime exports/usages and delete obsolete debug-only code paths

## 4. Verification

- [x] 4.1 Add or update tests for gateway factory/device connection behavior with simulated runtime enabled
- [x] 4.2 Add protocol/runtime regression tests that verify simulated transport responses exercise the shared burner code path
- [x] 4.3 Run targeted test suites and finish the OpenSpec task checklist based on verified results
