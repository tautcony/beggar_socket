## Context

The planner currently builds synthetic sectors starting at baseAddress. Downstream erase and progress consume these addresses, while programming uses a logical file offset.

## Goals / Non-Goals

Goals: intersect a bounded logical range with validated physical regions, preserve actual sector addresses and sizes, and recover partial first sectors without negative offsets.

Non-goals: UI, adapter template restructuring, RTC, native services, and preservation of bytes outside the range in an erased physical sector.

## Decisions

Sort a copy of the geometry by physical address, validate safe integer sizes/counts/addresses, inclusive ends, totals and adjacency, then select the first and last intersecting sector per region using arithmetic. This avoids expanding every sector and respects top/bottom boot ordering. Reject zero-count regions for nonempty requests; size zero returns an empty result after validating the range arguments. Accept contiguous geometry starting at a nonzero physical address without relocating it.

Keep physical erasure and logical programming separate. Recovery resets written to max(0, sector.address - baseAddress). Existing write chunks already clamp to the sector end and logical end; verification reads from baseAddress and batteryless saves use their own logical offset.

## Risks / Trade-offs

Whole-sector erase clears bytes before/after a partial write range within the same sector. Tests assert program bounds and whole physical erase effects, not unsupported preservation. Older tests describe relocation and malformed inclusive ends; repair fixtures to supply actual geometry, retaining meaningful aligned expectations.
