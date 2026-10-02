## ADDED Requirements

### Requirement: Reject invalid runtime time data before hardware access

RTC setters MUST reject null, arrays, non-objects, missing fields and non-number, non-finite or fractional fields before device I/O, capability checks or cleanup. GBA MUST require year 0..99, month 1..12, a valid calendar date, weekday 0..6, hour 0..23 and minute/second 0..59. MBC3 MUST require day 1..365 or 366 for the current year and the same clock bounds.

#### Scenario: Invalid field supplied
- **WHEN** a required field contains NaN, Infinity, a fraction, a string or an out-of-range value
- **THEN** the promise rejects without any device operation

#### Scenario: Valid calendar and ordinal boundaries
- **WHEN** a valid GBA leap day or current-year MBC3 final ordinal is supplied
- **THEN** the existing hardware write sequence accepts it

### Requirement: Preserve stable input semantics

RTC setters MUST snapshot validated fields before their first await. GBA weekday MUST remain independently selectable. MBC3 day MUST remain a current-year ordinal. DateTime setters MUST reject invalid DateTime values and converted values outside supported ranges before I/O.

#### Scenario: Caller changes the input during device work
- **WHEN** the caller mutates its object after setTime begins
- **THEN** writes use the validated original field values

#### Scenario: Invalid DateTime
- **WHEN** an invalid DateTime or an unsupported converted range is supplied
- **THEN** the setter rejects without any device operation
