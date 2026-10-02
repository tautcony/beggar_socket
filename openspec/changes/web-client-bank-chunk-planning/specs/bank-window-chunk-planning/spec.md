## ADDED Requirements

### Requirement: Bank-window-bounded transfers

ROM read/verify and RAM read/write/verify SHALL clamp every command to the bytes remaining in the current bank window and SHALL preserve MBC type address mapping and GBA protocol address units.

#### Scenario: Non-aligned transfer crosses two windows
- **WHEN** a transfer starts sixteen bytes before a bank boundary and spans multiple banks with distinct contents
- **THEN** every command remains within its current window and the complete data matches the requested logical bytes

### Requirement: GBA RAM absolute bank selection

GBA RAM transfers SHALL choose banks and cartridge offsets from baseAddress plus transferred bytes, including retries.

#### Scenario: Second-bank base address
- **WHEN** a SRAM or FRAM transfer starts in bank one
- **THEN** bank one is selected before data access and cartridge offsets match the logical address modulo 64 KiB

### Requirement: Existing programming compatibility

Existing ROM programming sector and bank clipping SHALL preserve command ordering and recovery behavior.

#### Scenario: Existing aligned write regression
- **WHEN** existing adapter writeROM recovery tests execute
- **THEN** erase, sample, bank switching and program transcripts retain their expected behavior
