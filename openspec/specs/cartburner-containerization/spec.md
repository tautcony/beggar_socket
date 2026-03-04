## Purpose

Define CartBurner containerization boundaries so orchestration logic stays in container/composable layers while operation panels remain presentational and contract-driven.

## Requirements

### Requirement: CartBurner container and presentation separation
The system SHALL separate `CartBurner` into a container orchestration layer and presentational operation components so flow control and rendering concerns are isolated.

#### Scenario: Container provides operation state and handlers
- **WHEN** `CartBurner` renders operation panels
- **THEN** it passes declarative state and event handlers into presentational components instead of embedding protocol or adapter orchestration in those components

#### Scenario: Presentational component remains side-effect free
- **WHEN** a presentational operation component is rendered in isolation tests
- **THEN** it can execute user interactions via emitted events without requiring direct device, transport, or protocol dependencies

### Requirement: Unified cross-cutting UI state in container
The system SHALL centralize progress modal, log stream, result modal, and busy/cancel state management in the CartBurner container boundary.

#### Scenario: Operation starts from any panel
- **WHEN** ROM, RAM, or chip operation starts
- **THEN** progress visibility, busy state, and log channel are managed by one container-owned state model

#### Scenario: Operation is cancelled or fails
- **WHEN** cancellation or failure occurs during any operation flow
- **THEN** container-managed state converges to a consistent recoverable state and no panel-specific state machine is required for recovery

### Requirement: Stable component IO contracts for operation panels
The system SHALL define stable props/events contracts for chip, ROM, and RAM operation panels and SHALL keep orchestration internals behind the container API.

#### Scenario: Panel triggers write operation
- **WHEN** a panel emits a write/read/verify action event
- **THEN** the container resolves orchestration logic and returns updated UI state through contract-defined props

#### Scenario: Contract regression check
- **WHEN** panel contracts change in implementation
- **THEN** component tests detect incompatible props/events changes before integration

### Requirement: CartBurner container integration coverage
The system SHALL provide integration tests for containerized CartBurner flows covering read, write, verify, cancel, and error recovery semantics.

#### Scenario: Containerized happy path flow
- **WHEN** a read/write/verify flow is executed through containerized CartBurner
- **THEN** tests verify consistent progress updates, result reporting, and log behavior against existing user-visible semantics

#### Scenario: Containerized failure and recovery flow
- **WHEN** an operation fails or is cancelled
- **THEN** tests verify busy/progress state reset, normalized error outcome, and ability to start subsequent operations
