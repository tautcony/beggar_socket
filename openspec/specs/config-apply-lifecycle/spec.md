## Purpose

Define how validated pending configuration becomes active runtime configuration.

## Requirements

### Requirement: Pending configuration can be explicitly applied to current configuration
The system SHALL provide an explicit apply path that promotes validated `pending_config` values into `current_config`.

#### Scenario: Host triggers apply after editing configuration
- **WHEN** the host has written valid configuration changes and triggers the apply action
- **THEN** the system copies the accepted pending values into `current_config`

#### Scenario: Host triggers apply when no changes are pending
- **WHEN** the host triggers apply while `pending_config` already matches `current_config`
- **THEN** the system completes successfully without changing runtime behavior

### Requirement: Applied ROM configuration affects ROM export reads
The system SHALL use the applied ROM configuration from `current_config` when serving `/ROM/CURRENT.GBA`.

#### Scenario: Pending ROM config is not yet applied
- **WHEN** the host edits ROM configuration but has not triggered apply
- **THEN** `/ROM/CURRENT.GBA` continues to reflect the previously applied `current_config`

#### Scenario: Pending ROM config has been applied
- **WHEN** the host applies a valid pending ROM configuration
- **THEN** subsequent reads from `/ROM/CURRENT.GBA` use the updated `current_config` window

### Requirement: Status reporting reflects apply completion
The system SHALL expose whether pending configuration has been applied through status reporting.

#### Scenario: Host reads status before apply
- **WHEN** the host reads `STATUS.TXT` while `pending_config` differs from `current_config`
- **THEN** the returned text indicates unapplied changes remain

#### Scenario: Host reads status after apply
- **WHEN** the host reads `STATUS.TXT` after a successful apply
- **THEN** the returned text indicates `pending_config` and `current_config` are aligned
