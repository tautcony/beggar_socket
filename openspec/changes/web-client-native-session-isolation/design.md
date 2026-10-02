## Context

The registry currently owns ports directly and blocks every native serial command during any I/O. Command signatures and serialport 4.9.0 remain unchanged.

## Goals / Non-Goals

**Goals:** Independent sessions, serialized operations within a session, exact reads with total deadlines, and truthful close completion.

**Non-Goals:** Forcing cancellation of an arbitrary OS driver call or changing frontend ownership.

## Decisions

The registry stores Arc session owners. Each owner has an atomic closing flag and a mutex containing an optional port session. Registry locks only clone, insert, or remove owners. Operations check admission before and after acquiring the owner mutex.

Close marks the owner closing under registry lookup, then waits for its operation mutex, takes and drops the port, and removes the owner. Concurrent closes share the same owner and wait for disposal; commands holding a previously cloned owner still reject closing. A failed close retains its closing owner for retry.

Read and write loops use a total deadline and at most 50ms serial timeouts, retry interrupted calls and slice timeouts, and observe close between calls. Flush remains serialized and close waits for its actual return. No detached worker or synthetic timeout reports false resource termination.

Native serial commands are async and dispatch all driver calls and operation-lock waits through Tauri's existing spawn_blocking runtime. A synchronous command wrapper would otherwise execute its command body inline and defeat independence at the command/UI scheduling boundary. Tests call the production async worker helpers and assert that operations execute on another thread.

Windows COMPort::write returns Ok(0) when WriteFile succeeds with no progress, including timeout. The serial-specific write loop retries this result until its original total deadline, yielding for at most 1ms between immediate zero-progress calls. This differs deliberately from generic Write::write_all's immediate WriteZero failure. Empty writes still flush; zero-length reads still return an empty buffer.

Tests use a SerialPort mock with controlled barriers and drop counters. A Windows native job avoids unrelated Linux GUI library setup and is included in the reusable quality gate required by packaging.

## Risks / Trade-offs

- OS write/flush can ignore portable timeout controls → close waits truthfully; document concrete serialport implementation limitations.
- In serialport 4.9.0, Windows write uses synchronous WriteFile with SetCommTimeouts; flush uses FlushFileBuffers without a timeout/cancellation parameter. POSIX write polls then calls write, and flush calls tcdrain; its timeout only limits retries after EINTR, not a blocking tcdrain. Slices therefore request cooperative bounds, not arbitrary driver cancellation. Late driver progress is reported as a deadline error after return, and close waits for actual termination.
- Mutex poisoning → preserve deterministic errors; close can recover the owner lock to release the port.
- Blocking native commands → bounded slices improve cooperative cancellation but do not replace Tauri command scheduling.

## Validation

- `cargo test --locked`: 14 native unit tests passed on Windows, including worker scheduling, independent sessions, admission races, close joins, once-only disposal, fragmented I/O, deadlines, cancellation, and error cleanup.
- `cargo check --locked`: passed with the checked-in Cargo.lock.
- `npm run test:run -- tests/architecture/quality-workflow.test.ts`: 5 workflow contract tests passed. The native gate contract failed before the native job was added.
- The final-driver-progress deadline regression failed first because a late final read returned success; it passed after final read/write deadline checks were added.
- Only native source files were processed with scoped rustfmt, and unrelated save/export formatting was restored. No hardware or arbitrary-driver cancellation claims are made.
