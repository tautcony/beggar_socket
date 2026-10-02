## ADDED Requirements

### Requirement: Physical sector intersection
The planner SHALL return complete physical sectors intersecting [baseAddress, baseAddress + size), preserving their actual sizes and physical addresses.

#### Scenario: Mixed geometry and nonzero base
- **WHEN** a range starts in a large sector after bottom boot sectors or crosses a region boundary
- **THEN** only intersecting physical sectors are selected, including partial first and last sectors

#### Scenario: Top boot geometry
- **WHEN** a range intersects top boot sectors and regions are supplied out of order
- **THEN** selected sectors appear in increasing physical address order with their original sizes

### Requirement: Valid bounded geometry
The planner SHALL reject negative, fractional, nonfinite or unsafe arguments and inconsistent, overlapping, gapped, empty or overflowing geometry for nonempty ranges, and SHALL reject ranges outside geometry capacity.

#### Scenario: Tail exceeds capacity
- **WHEN** baseAddress + size exceeds the final region end by one byte
- **THEN** planning fails before erase or program commands

#### Scenario: Invalid geometry
- **WHEN** sector count, size, total, inclusive end or region adjacency is inconsistent
- **THEN** planning fails deterministically

#### Scenario: Empty range
- **WHEN** size is zero and baseAddress is a valid nonnegative safe integer
- **THEN** the planner returns an empty result without requiring geometry

### Requirement: Bounded logical data transfer
ROM writers SHALL erase the selected physical sectors and program only logical bytes within the requested range; verification SHALL read only the requested range.

#### Scenario: Partial sectors
- **WHEN** a write begins within one sector and ends within another
- **THEN** erase addresses are physical sector starts and program/read offsets remain within the logical range
