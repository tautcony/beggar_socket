# MCU Agent Notes

## Scope

These notes apply to work under `mcu/`, especially USB MSC, FAT16 virtual-disk, and cartridge-export tasks.

## Lessons From `fat16-read-only-virtual-disk`

- Read OpenSpec and other text docs with explicit UTF-8 in PowerShell. Use `Get-Content -Encoding UTF8`, and set `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8` before relaying content. Do not trust the terminal default encoding.
- For firmware-scoped requests, do not modify `web-client` unless the user explicitly asks for cross-project changes or the evidence clearly shows the bug is not in `mcu/`.
- FAT directory entry names are exactly 11 bytes in 8.3 form with no dot. When using fixed strings for virtual files, make them exactly 11 characters long before copying into the directory entry. Otherwise Windows may show truncated names like `CURRENT. GB`.
- For Windows compatibility, virtual TXT files should be emitted as UTF-8 with BOM.
- FAT subdirectories should include explicit `.` and `..` entries. Missing them can cause host directory-open hangs.
- Keep raw cartridge reads separate from windowed file-view reads. Metadata generation such as CFI probing or ROM-size detection must not re-enter APIs that depend on the same metadata, or recursion/hangs can occur.
- If a writable virtual control file is needed, keep the write surface narrow and in-memory. Parse only the intended keys and avoid turning the virtual FAT layout into a general writable filesystem.

