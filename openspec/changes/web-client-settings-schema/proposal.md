## Why

Advanced settings currently trust runtime JSON and permit non-finite numbers to bypass validation. Loading also rewrites legitimate legacy page sizes without evidence that they were defaults.

## What Changes

- Validate runtime object structure and finite integer values using existing setting descriptors.
- Apply configuration updates atomically while preserving documented setter clamping and truncation.
- Save a versioned snapshot under the existing storage key and preserve valid unversioned values.
- Reject unsupported persisted versions safely without overwriting their data.

## Capabilities

### New Capabilities

- `advanced-settings-schema`: Runtime settings validation and safe versioned persistence.

### Modified Capabilities

None.

## Impact

Only advanced-settings.ts, its unit tests, and this change's artifacts. No dependencies or timeout integration changes.
