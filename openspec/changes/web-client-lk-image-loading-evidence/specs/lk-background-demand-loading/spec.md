## ADDED Requirements

### Requirement: Load background processing only on demand

The LK builder SHALL request its image processing module only when a background buffer is supplied. It SHALL preserve existing ROM output without a background.

#### Scenario: No background
- **WHEN** a build omits the background option
- **THEN** the image module is not evaluated and the golden ROM bytes remain unchanged

### Requirement: Preserve background behavior and ownership

The LK builder SHALL await background processing before compiling the updated menu, preserve processing errors, and leave caller input buffers and configuration unchanged.

#### Scenario: Valid background
- **WHEN** a valid PNG and a menu with its background marker are supplied
- **THEN** encoded image bytes are included in the output and caller inputs remain unchanged

#### Scenario: Background processing fails
- **WHEN** processing rejects
- **THEN** the build rejects with the same error and does not change caller buffers

### Requirement: Bound performance claims to measurements

Performance documentation MUST identify the environment, commands, bundle byte measurements and unmeasured runtime surfaces.

#### Scenario: Production bundle evidence
- **WHEN** emitted JavaScript is measured
- **THEN** raw and gzip bytes are recorded without inferring browser or hardware latency
