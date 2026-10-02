## Context

Geometry feeds sector planning and buffered writes. `getCartInfo` already returns false on parser failure. No adapter mutation is required for invalid query responses.

## Goals / Non-Goals

**Goals:** complete descriptors, positive safe sizes, capacity agreement, datasheet-backed compatibility.

**Non-Goals:** new command sets, synthesized sector commands for bulk-only devices, hardware qualification.

## Decisions

- Return false for unsafe exponents, truncated descriptors and capacity mismatch; consumers already recognize false. A detectionError-only result could still feed existing write paths.
- Parse all declared regions after checking the last accessed byte. Keep existing 0x79 minimum header for compatibility with current query transport.
- Decode sector size zero as 128 bytes, documented in [Microchip CoreCFI Handbook, table 4-4](https://ww1.microchip.com/downloads/aemdocuments/documents/fpga/ProductDocuments/ReleaseNotes/corecfi_hb.pdf). Region count zero means bulk erase, not malformed CFI; retain device information and an empty block list. `calcSectorUsage([], positiveSize)` already throws before sector erase/write planning, verified by a regression. Do not synthesize sector commands.
- Verify [Infineon GL-T table 28](https://www.infineon.com/dgdl/Infineon-S29GL01GT_S29GL512T_1-Gb_%28128_MB%29_512-Mb_%2864_MB%29_GL-T_MirrorBit_Eclipse_Flash-DataSheet-v14_00-EN.pdf?fileId=8ac78c8c7d0d8da4017d0ed2abb34fce) 64/128 MB uniform regions, and [Infineon S29AL032D tables 13–14](https://www.infineon.com/assets/row/public/documents/10/57/infineon-s29al032d-32-mbit-3-v-flash-4-m-x-8-bit-uniform-sector-4-m-x-8-bit-2-m-x-16-bit-boot-sector-datasheet-additionaltechnicalinformation-en.pdf?fileId=8ac78c8c7d0d8da4017d0ed78183589f) two-region boot variants. Fixtures transcribe query fields, not physical captures.
- Require safe integer sizes and buffer size no greater than device size; do not add arbitrary supported-chip capacity limits. Keep existing buffer capability threshold.
- Format actual parsed blocks and their inclusive ends; bound bad-magic diagnostic dumps to 0x100 bytes.

## Risks / Trade-offs

- Unknown nonstandard capacity mismatch may have been accepted → reject instead of using contradictory geometry; no evidence of supported mismatched hardware was found. Add a documented chip-specific normalization only with future physical/datasheet evidence.
- Bulk-only CFI is valid but lacks sector commands → preserve information/read compatibility; sector planning rejects positive ranges. Supporting bulk erase requires a separate command-aware design.
- The adapter can receive manually constructed CFIInfo → this change validates parser results, not arbitrary caller-created objects.
