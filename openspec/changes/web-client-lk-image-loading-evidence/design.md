## Context

`buildRom` dynamically imports `imageUtils` even when its optional background is absent. That module imports Jimp and image-q. The MultiMenu UI has its own default background and library-ready interaction contract.

## Goals / Non-Goals

Goals: avoid the no-background module evaluation and preserve build bytes, input ownership and errors; record reproducible production bundle evidence.

Non-Goals: alter UI preload, replace libraries, add workers, change bundle configuration or assert browser/hardware latency improvements.

## Decisions

Guard the existing dynamic import with the same truthiness condition already used by `updateBackgroundImage` and compilation copy-back. Preserve the background path ordering. Test module evaluation with a lazy Vitest mock factory, and exercise real image encoding in a separate integration test file. Retain the existing 8 MiB golden fixture.

Measure emitted JavaScript files with Node fs/zlib after the existing production Vite command. Report raw bytes and gzip level 9, input revisions and warnings. Bundle output is size evidence, not runtime latency.

## Risks / Trade-offs

Other UI paths still request image libraries → document those imports and do not promise application-wide deferred loading.

Module mocks can conceal encoding regressions → add a real PNG build fixture plus existing quantization tests.
