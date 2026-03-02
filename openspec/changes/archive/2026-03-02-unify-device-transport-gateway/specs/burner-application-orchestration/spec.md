## ADDED Requirements

### Requirement: Burner orchestration uses transport abstraction
The Burner orchestration layer SHALL execute protocol communication through the `Transport` interface provided by device gateway context, and SHALL NOT depend on `SerialService` or runtime-specific connection types.

#### Scenario: Burner flow invokes protocol adapter
- **WHEN** any burner use case triggers protocol send/read logic
- **THEN** the call path passes a `Transport` abstraction into protocol integration and does not import `SerialService`

#### Scenario: Runtime swap does not change orchestration contract
- **WHEN** burner orchestration runs in Web versus Electron runtime
- **THEN** the orchestration API and flow behavior remain unchanged because runtime differences are contained behind gateway/transport implementations

### Requirement: Migration compatibility for burner flows during gateway transition
The system SHALL preserve user-visible burner flow behavior while migrating from concrete serial-service dependencies to gateway/transport abstractions.

#### Scenario: Existing burner operation after migration step
- **WHEN** a previously working burner operation is migrated to gateway/transport based integration
- **THEN** busy state, cancellation handling, result shape, and progress semantics remain functionally equivalent
