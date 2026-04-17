## MODIFIED Requirements

### Requirement: Single-source MBC detection in burner flows
The system SHALL use parser-layer MBC detection as the single rule source for Burner ROM-related flows, and SHALL NOT keep a separate MBC detection implementation in `CartBurner.vue`.

#### Scenario: Burner flow needs MBC type for operation planning
- **WHEN** a Burner read/write/verify flow requires MBC type detection
- **THEN** the flow uses parser-provided detection and does not execute component-local MBC detection logic

#### Scenario: Component code path after migration
- **WHEN** `CartBurner.vue` triggers a flow that depends on MBC type
- **THEN** the component consumes orchestration/parser results and does not contain an internal `detectMbcType` implementation

#### Scenario: ROM verify uses resolved MBC type for bank switching
- **WHEN** Burner ROM verification iterates across cartridge banks for an MBC1, MBC3, or MBC5 cartridge
- **THEN** the verify path passes the resolved MBC type through bank-switch operations so validation reads the intended bank map instead of defaulting to MBC5 behavior

## ADDED Requirements

### Requirement: ROM verification regression coverage across MBC families
The system SHALL provide regression coverage for ROM verification against cartridge types whose bank-switch rules differ.

#### Scenario: MBC3 verify no longer reports false negative because of MBC5 bank rules
- **WHEN** regression tests execute ROM verify against an MBC3 cartridge fixture or equivalent adapter mock
- **THEN** the verification flow reads the expected banks and does not fail solely because the wrong bank-switch routine was selected
