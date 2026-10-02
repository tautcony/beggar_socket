## ADDED Requirements

### Requirement: Current module navigation and source references
Module documentation SHALL identify current Web, Tauri and simulated entrypoints and retain navigation from the historic Electron document. Referenced repository paths and documented quality commands MUST resolve to existing files and scripts.

#### Scenario: A runtime implementation is moved
- **WHEN** a documented source entrypoint or module link no longer exists
- **THEN** documentation contract tests fail with the broken reference

### Requirement: Evidence-backed finding status
Finding status SHALL distinguish tested code fixes from pending physical, browser and performance acceptance. Historical phase reports MUST remain unchanged.

#### Scenario: A code fix has unit coverage without hardware acceptance
- **WHEN** a finding is mapped to its implementation and tests
- **THEN** the status records that evidence and retains hardware acceptance as pending
