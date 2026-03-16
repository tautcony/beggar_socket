# Beggar Socket - AI Coding Instructions

ChisFlash Burner is a **multi-platform GBA/GBC cartridge programmer** with three main components: embedded firmware (STM32), desktop client (C#), and web client (Vue 3 + TypeScript).

## 🏗️ Architecture Overview

### Three-Tier System
- **MCU (`mcu/`)**: STM32F103C8T6 firmware handling low-level cartridge I/O via custom USB protocol
- **Desktop Client (`client/`)**: C# WinForms app for Windows users  
- **Web Client (`web-client/`)**: Vue 3 + Vite app supporting WebSerial API + Electron desktop packaging

### Communication Flow
```
Web/Desktop Client → WebSerial/SerialPort → STM32 USB CDC → Hardware Protocol → Cartridge
```

## 🔧 Key Development Patterns

### Protocol Implementation (`web-client/src/protocol/beggar_socket/`)
- Commands defined in `command.ts` (GBA: 0xf0-0xf6, GBC: 0xf7-0xfc)
- All communication uses **little-endian** format with CRC (ignored by firmware)
- Use `protocol-adapter.ts` for high-level operations, `protocol.ts` for raw commands
- Example: `rom_get_id()` sends unlock sequence then reads manufacturer/device IDs

### Service Layer Architecture (`web-client/src/services/`)
- **Adapter pattern**: `CartridgeAdapter` base class → `GBAAdapter`, `MBC5Adapter` implementations
- **Device abstraction**: `DeviceConnectionManager` handles WebSerial/Electron SerialPort differences
- **Protocol isolation**: Services call protocol functions, views call services

### Vue 3 + Composition API Conventions
- Use `<script setup lang="ts">` syntax exclusively
- Store shared state in Pinia stores (`stores/rom-assembly-store.ts`)
- Composables in `composables/` for reusable logic
- All text must be i18n-compatible using `$t()` and `i18n/` locale files

### Testing Strategy (`tests/`)
- **Vitest** for unit tests with coverage reporting
- Protocol parsers have comprehensive test suites (see `cfi-parser-improvements.test.ts`)
- Test file naming: `{feature}.test.ts`
- Run tests: `npm run test`, coverage: `npm run test:coverage`

## 🚀 Development Workflows

### Web Client Development
```bash
cd web-client
npm install        # Install dependencies
npm run dev       # Start dev server (localhost:5173)
npm run electron:dev  # Start Electron + dev server concurrently
```

### Building & Distribution
- **Web build**: `npm run build` → `dist/` (for web deployment)
- **Electron build**: `npm run electron:build:mac:universal` → `dist-electron/` 
- Uses `electron-builder` with config in `package.json` → `build` section

### MCU Development
```bash
cd mcu/chis_flash_burner
./cmake-build.sh   # CMake + ARM GCC toolchain build
```

## ⚡ Critical Implementation Details

### Device Detection Pattern
```typescript
// Always filter by STM32 VID/PID: 0x0483/0x0721
const filter = PortFilters.device(0x0483, 0x0721);
await SerialService.requestPort(filter);
```

### Error Handling Convention
- Protocol functions throw descriptive errors
- Services catch and translate to user-friendly messages via i18n
- Use `formatHex()` for consistent hex display in logs/errors

### File Processing Pipeline
1. **Upload** → Parse ROM headers (see `utils/rom-parser.ts`)
2. **Validate** → Check size limits, cartridge type detection  
3. **Process** → Apply patches, compression if needed
4. **Program** → Chunk into protocol-appropriate sizes (max 5000 bytes)

### Cross-Platform Considerations
- **Web**: WebSerial API (Chrome/Edge only)
- **Electron**: Native SerialPort with fallback to WebSerial
- **Device detection**: Use `DeviceConnectionManager.isElectronEnvironment()`

## 🎯 Common Tasks & Patterns

### Adding New Cartridge Support
1. Create adapter in `services/{type}-adapter.ts` extending `CartridgeAdapter`
2. Add protocol commands in `protocol/beggar_socket/` if needed
3. Add UI view in `views/` with i18n translations
4. Register route in `router/index.ts`

### Protocol Debugging
- Enable advanced settings for detailed logging
- Use `SerialTestView.vue` for raw protocol testing
- Check `protocol-utils.ts` for packet debugging utilities

### Performance Testing
- ROM processing: `npm run test:performance`  
- Bundle analysis: `npm run build:analyze`
- Use `--coverage` flag for test performance insights

## 🔍 Code Review

When asked to perform a code review (用户请求代码审查时), invoke the **Code Review Meta-Skill**:

```
Skill file: .github/skills/code-review/SKILL.md
```

The skill defines a complete, phase-based review process:
1. **Explore** codebase structure and existing documentation
2. **Generate** a dynamic review plan (Phase 0 → Phase N → Cross-cutting)
3. **Execute** each Phase using parallel `Explore` subagents
4. **Write** phase reports to `docs/review/phase-N-{name}.md`
5. **Synthesize** into `docs/review/summary.md`
6. **Output** actionable `docs/review/fixes-plan.md`

Historical review reports are in `web-client/docs/review/` — use `summary.md` as baseline to avoid re-reporting resolved issues.

**Problem category codes** (C1–C11) and **severity levels** (P0–P2/INFO) are defined in the skill file.

---
*Focus on protocol correctness, cross-platform compatibility, and maintainable Vue 3 patterns when contributing.*
