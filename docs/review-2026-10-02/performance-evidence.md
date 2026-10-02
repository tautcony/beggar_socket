# Web Client performance evidence

Measured on 2026-10-03, Windows x64, Node 24.19.0, Vite 8.2.0. Input was local HEAD `e5ec9a6505066fb03aaaef43e3df60fe20970d1d` plus this task's conditional LK image import and tests. Other agents shared the working tree; the UI orchestration changes were present. These values describe this snapshot and are not a controlled before/after latency experiment.

## Safe change and behavioral evidence

`web-client/src/services/lk/romBuilder.ts` now imports `imageUtils` only when `options.bgImage` is truthy. Previously every build imported that module and then its background function immediately returned when no background was supplied. Image processing still runs before copying the updated menu into the compilation, and processing failures still reject the build.

The new loading test observes execution of a lazy module factory, rather than matching source text: before the fix the no-background test failed with one evaluation; after the fix it records zero evaluations. Background success and failure each evaluate the module once. The mock registry is renewed for each test so a previously cached factory cannot produce a false zero result. Real PNG integration verifies encoded bitmap/palette bytes, an RGB555 red pixel, malformed PNG errors, marker validation and caller input preservation. The existing fixed-timestamp 8 MiB golden ROM remains byte-identical. Focused validation: six files, 51 tests passed (including six new tests).

This change avoids an unnecessary module request in direct no-background builds. It does not remove the dependencies from the production bundle and does not establish an application-wide loading reduction.

## Production JavaScript size

Command in `web-client`: Node 24.19.0 executing `node_modules/vite/bin/vite.js build --mode production`. The build succeeded with 1,969 transformed modules; its own reported duration was 7.65 seconds. One build was measured, with no controlled cold-cache comparison. No runtime speed improvement is inferred from that duration.

Files below are emitted minified JavaScript. Sizes are exact bytes; gzip uses Node `gzipSync(data, { level: 9 })`, which differs from Vite's displayed default compression. Totals sum all 17 JavaScript files compressed separately. They exclude CSS, HTML, source maps, images and other static assets and do not represent first-page download bytes.

| Chunk | Raw bytes | Gzip level 9 bytes |
| --- | ---: | ---: |
| ionic-DbLcpceQ.js | 1,256,510 | 283,227 |
| jimp-gL0iDUmL.js | 718,322 | 209,467 |
| index-Dd6aOJXp.js | 414,667 | 122,966 |
| GBCEmulator-ZS6YT7nN.js | 365,213 | 131,996 |
| HomeView-BcQr52lG.js | 322,308 | 83,005 |
| GBAEmulator-DoRKfL82.js | 190,316 | 41,829 |
| sentry-BZXJDlj2.js | 121,537 | 39,285 |
| luxon-BE2T-kmh.js | 70,540 | 22,054 |
| vue-C3lboERH.js | 52,349 | 17,297 |
| imageUtils-Bu_MpPf7.js | 48,015 | 13,574 |
| GBAMultiMenuView-BumrACB1.js | 29,032 | 9,454 |
| RomAssemblyView--ji0QLFb.js | 10,278 | 3,994 |
| FileDropZone-DIKwvdH1.js | 3,596 | 1,625 |
| formatter-utils-DBVHmpY7.js | 2,554 | 1,254 |
| BaseButton-mCjL65On.js | 1,442 | 757 |
| rolldown-runtime-I3TIJKkN.js | 237 | 200 |
| useToast-DtHGS9lB.js | 213 | 197 |
| **All emitted JS** | **3,607,129** | **982,181** |

To reproduce byte measurements after the existing build, run this JavaScript with the selected Node runtime from `web-client` (stdin or a temporary file):

```js
const fs = require('node:fs');
const zlib = require('node:zlib');
const rows = fs.readdirSync('dist/assets')
  .filter(name => name.endsWith('.js'))
  .map(name => {
    const data = fs.readFileSync(`dist/assets/${name}`);
    return { name, raw: data.length, gzip9: zlib.gzipSync(data, { level: 9 }).length };
  });
console.table(rows);
console.log(rows.reduce((sum, row) => ({
  raw: sum.raw + row.raw, gzip9: sum.gzip9 + row.gzip9,
}), { raw: 0, gzip9: 0 }));
```

## Import relationships and existing UI behavior

The emitted `imageUtils` chunk imports the Jimp chunk. Its source map includes `image-q/dist/esm/image-q.mjs`, `@jimp/plugin-resize` and `src/services/lk/imageUtils.ts`. The emitted MultiMenu chunk contains references to both imageUtils and Jimp.

`web-client/src/composables/useMultiMenuState.ts` still preloads the image library and loads a default `bg.png`, generates its preview, and uses library-ready state in its interaction flow. `web-client/public/bg.png` exists: 709 bytes, SHA-256 `5797a5815ba7f03a50d5039e0a6d6029d94a9266cecdf023b775532977c6330c`. Both the preview path and LK background processing need the libraries. This task leaves that UI behavior intact. A direct no-background build can skip importing imageUtils; entering the MultiMenu view can still request image libraries independently.

The production build retains its existing warnings: browser-externalized `fs` from gbats, direct `eval` in Jimp, chunks above 500 kB, and overlapping plugin timing measurements. Chunk splitting alone does not remove the work of decoding and quantizing a supplied image.

## Unmeasured surfaces and next evidence

No browser navigation waterfall, first contentful paint, image preview latency, CPU/memory profile, emulator frame/audio responsiveness, Tauri IPC throughput or physical device operation latency was measured. Node/Vitest image correctness and bundle sizes cannot establish these results. No image-library replacement, worker or IPC representation change is justified by this snapshot alone.

For further performance work, capture a browser profile on a named browser/device with controlled cache state and identical ROM/background inputs; compare route entry, preview and build latency separately, including memory peaks. Emulator audio/control responsiveness and native serial throughput require their own traces and hardware runs. These are validation opportunities, not completed measurements.
