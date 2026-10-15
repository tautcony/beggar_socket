## Purpose

Enable users to resume and recover raw GBA cartridge save data in the emulator preview, preserve progress across its lifecycle, and exchange save files with the existing RAM workflow in browser and desktop runtimes.

## ADDED Requirements

### Requirement: Selected raw save import before gameplay

The system SHALL allow a selected raw GBA SAV to initialize a preview before any gameplay executes. Import SHALL leave the source ROM/SAV bytes unchanged. Starting without a selected save SHALL remain supported.

#### Scenario: Launch with a matching save filename
- **WHEN** a user starts a GBA preview with a supported SAV whose basename matches the ROM basename case-insensitively
- **THEN** the preview starts with those save contents available to the game before its first execution frame
- **AND** the selected source bytes remain unchanged as the game modifies its save

#### Scenario: Launch with different filenames
- **WHEN** a selected ROM and SAV have different basenames
- **THEN** the system identifies both files and requires an explicit choice to use the SAV or start without it before gameplay begins
- **AND** cancelling that choice leaves selected files unchanged

#### Scenario: Launch without a save
- **WHEN** the user starts without a selected SAV or explicitly chooses not to use it
- **THEN** the preview can run and produce new save data without replacing the unselected SAV

### Requirement: Save format and capacity validation

The system SHALL keep the core's physical save window separate from the selected raw SAV file length. It SHALL accept any non-empty raw byte length for a ROM with a recognized SRAM, Flash, or EEPROM save type, preserve bytes outside the core-addressable window, and leave the native core backing allocation unchanged. Payload `capacity` SHALL report the effective core window; payload `data` SHALL contain the complete owned raw image. An empty file or unresolved ROM save type SHALL be rejected. Since raw SAV data has no universal signature, the system SHALL NOT claim that length or byte patterns authenticate a game's identity or reject a raw image solely because its length differs from the core window.

#### Scenario: Preserve an image larger than the core window
- **WHEN** a non-empty raw SAV is larger than the detected ROM's native save window
- **THEN** the core imports only the prefix it can address while the full input image remains owned by the session
- **AND** each checkpoint and final output replaces that prefix with core data and preserves all trailing bytes

#### Scenario: Normalize a short raw image
- **WHEN** a non-empty raw SAV is shorter than the native core window
- **THEN** the core imports that prefix and the remaining window is initialized from its original backing bytes
- **AND** the initial baseline and checkpoint use the same normalized full image

#### Scenario: Empty import
- **WHEN** the selected raw file has zero bytes
- **THEN** the preview reports the validation failure before gameplay and preserves the original files for correction
- **AND** starting without the invalid save requires an explicit user choice

#### Scenario: EEPROM runtime window and raw image length
- **WHEN** EEPROM runtime access establishes a 512-byte or 8192-byte window
- **THEN** the core window and payload `capacity` use that runtime size while export preserves at least the entire selected image length
- **AND** a file-size hint that differs from the runtime window does not reject the import

#### Scenario: Unresolved EEPROM window
- **WHEN** no save was imported and EEPROM runtime access has not established its window
- **THEN** the system prevents an ambiguously sized export and explains the issue

### Requirement: Session ownership and guarded RAM writeback

The system SHALL associate each preview result with its original ROM/save selection and SHALL replace RAM file state on normal close only for a changed result whose source selections remain current and whose burner is idle. Its target SHALL be the associated imported SAV or a RAM selection that was empty at launch. Filename equality alone SHALL NOT authorize stale writeback. Writeback SHALL NOT start a cartridge operation or overwrite the source file on disk.

#### Scenario: Changed save returns to RAM
- **WHEN** a preview closes with changed valid save contents, its original associated SAV or empty RAM target remains current, and no burner operation is active
- **THEN** the RAM panel receives the latest save bytes and original save filename, or the ROM basename with `.sav` for a newly created save
- **AND** the returned save is available to existing RAM operations

#### Scenario: No gameplay save changes
- **WHEN** a preview closes without changing the imported or initial save contents
- **THEN** the selected RAM file state is left unchanged

#### Scenario: Existing save was deliberately not used
- **WHEN** the user starts without using an existing selected SAV and the preview produces new save data
- **THEN** that existing SAV remains unchanged and the new output is retained for export or explicit discard

#### Scenario: Replacement or busy state prevents writeback
- **WHEN** the ROM or RAM file has been replaced or cleared since launch, even under the same name, or the burner is busy when the result arrives
- **THEN** the current RAM file state remains unchanged
- **AND** the old session output remains available for export or explicit discard with its original file association shown

#### Scenario: Conflicted output is not lost
- **WHEN** a conflicted result remains unresolved
- **THEN** it survives closing the emulator dialog within the current container lifetime
- **AND** another preview cannot silently replace it

#### Scenario: Duplicate result delivery
- **WHEN** close and subsequent unmount both deliver the same session result
- **THEN** the result is applied or retained only once

### Requirement: Stable save checkpoints across emulator lifecycle

The system SHALL retain completed save checkpoints during a preview and preserve the latest valid save across reset and same-session error recovery. Normal close SHALL capture a stable final result before disposal. All disposal paths SHALL stop execution and prevent old sessions from updating new ones.

#### Scenario: In-game save is captured
- **WHEN** the game completes a settled storage write burst
- **THEN** the session retains an independent checkpoint containing those bytes for subsequent reset, recovery, or export

#### Scenario: Reset after saving
- **WHEN** the user resets a preview after changing its save
- **THEN** the restarted game uses the latest valid save instead of the original imported save
- **AND** the preview retains its prior play/pause state

#### Scenario: Close during pending storage writes
- **WHEN** a close request cannot obtain a stable result because storage writes remain pending
- **THEN** the system does not report a successful final writeback or discard the running session
- **AND** it explains how to finish saving and retry

#### Scenario: Recover after runtime failure
- **WHEN** a runtime failure occurs after a valid checkpoint was captured
- **THEN** the user can export that checkpoint or retry the same ROM with it
- **AND** the interface identifies recovery as the last valid checkpoint rather than guaranteeing unfinished writes were saved

#### Scenario: Cleanup and stale work
- **WHEN** a preview is closed, replaced, or unexpectedly unmounted
- **THEN** its execution, audio, and handlers stop, its last valid checkpoint is delivered on a best-effort basis if final capture is unavailable, and delayed work cannot affect a later preview

### Requirement: Raw SAV export across supported runtimes

The system SHALL provide explicit export of the latest valid save as a raw `.sav` file in browser and desktop runtimes, including retained conflict/recovery results. Export SHALL preserve selected RAM data and restore the preview's prior play/pause state.

User-facing file and preview text SHALL call this data RAM while preserving actual file extensions. Download of the selected RAM file SHALL reuse the existing file-card download icon without adding a duplicate download button to the RAM operation row.

#### Scenario: Browser download
- **WHEN** the user exports a valid save in the browser
- **THEN** the system initiates a download with the effective save bytes and a `.sav` filename
- **AND** feedback describes download initiation rather than asserting a verified disk write

#### Scenario: Desktop save
- **WHEN** the user completes the desktop save dialog
- **THEN** the selected destination receives the effective raw save bytes
- **AND** success is reported only after the platform confirms saving

#### Scenario: Export is cancelled or fails
- **WHEN** a save dialog is cancelled or export fails
- **THEN** no save success is reported, the save remains available for retry, and a retained recovery result is not discarded

### Requirement: Offline local save selection

The system SHALL allow local SAV selection, clearing, and download without a connected cartridge device, subject to existing busy restrictions. Cartridge operations SHALL retain their device and busy requirements.

#### Scenario: Disconnected emulator workflow
- **WHEN** no cartridge device is connected and the interface is idle
- **THEN** the user can select a local SAV and ROM and launch the GBA preview using that save
- **AND** cartridge read/write/verify controls remain unavailable

#### Scenario: Busy cartridge operation
- **WHEN** a cartridge operation is active
- **THEN** local RAM file replacement and automatic emulator result writeback cannot change the operation's selected input
