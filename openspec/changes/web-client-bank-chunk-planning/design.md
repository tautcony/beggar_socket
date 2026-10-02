## Context

Existing ROM programming already clips sectors and banks. Read/verify and RAM paths need the same bank boundary contract; GBA SRAM/FRAM use 64 KiB windows.

## Goals / Non-Goals

Goals: pure logical-to-cartridge chunk plans, correct non-aligned transfers, and regression coverage.
Non-Goals: ROM erase/program recovery redesign, transport framing, session lifecycle, native code, RTC and settings.

## Decisions

Use a pure service chunk planner returning bank, cartridge byte address, explicit protocol address unit, window remaining and bounded chunk size. MBC ROM windows are 16 KiB (MBC3 bank zero fixed window; other types retain 0x4000 base), RAM windows 8 KiB. GBA ROM retains its existing logical address and 32 MiB bank strategy; its bus uses word addresses while adapter/protocol API addresses remain bytes. GBA RAM maps absolute addresses to 64 KiB windows. Keep existing writeROM sector logic unchanged to preserve transcripts. Planner arguments require safe integer byte addresses and remaining lengths (non-negative), and positive safe integer page sizes; invalid values throw RangeError before transfer, while an exhausted length produces a zero chunk.

## Risks / Trade-offs

Boundary splitting adds commands for unaligned requests; regression tests assert exact content and no window overflow. GBA physical RAM supports two banks; existing bank switch behavior remains unchanged. No migration is needed.
