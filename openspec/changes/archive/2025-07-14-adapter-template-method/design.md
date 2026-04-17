## Context

适配器层是设备操作的核心实现层，连接协议层（设备通信）和编排层（业务流程）。代码审查 (review-2026-04-17 Phase 1 P1-01 ~ P1-05) 发现 GBAAdapter 和 MBC5Adapter 是项目中最严重的代码重复来源。Phase 6 P1-01 确认 GBA/GBC 二元镜像是项目最大的技术债，适配器层占总重复量的约 50%（~2500-3000 行）。

本变更依赖:
- `protocol-platform-abstraction`: 提供 `FlashCommandSet` 接口和通用 flash 操作
- `shared-constants-extraction`: 提供共享时序常量

本变更是四层 GBA/GBC 统一抽象的最大单项重构。

## Goals / Non-Goals

**Goals:**
- 将适配器层的通用操作流程提取为 `CartridgeAdapter` 基类中的模板方法
- 将 GBA/GBC 差异封装为 `PlatformOps` 接口
- GBAAdapter 和 MBC5Adapter 从 ~1700 行缩减至 ~250 行
- 提取进度初始化工厂方法消除 16+ 处模板代码
- 提取 PPB 解锁核心流程消除 ~420 行重复
- 保持所有操作的字节级行为不变

**Non-Goals:**
- 不改变适配器的公开 API（`CartridgeAdapter` 子类的方法签名不变）
- 不改变进度报告的格式或频率
- 不改变重试策略的参数或行为
- 不改变 bank 切换时序
- 不合并 GBAAdapter 和 MBC5Adapter 为单个类（保留双子类结构）
- 不重构 RTC 相关代码（虽有重复但独立性强，不在本范围内）

## Decisions

### D1: PlatformOps 接口设计

```typescript
interface PlatformOps {
  /** 平台标识 */
  platform: 'gba' | 'gbc';
  /** Flash 命令集（来自 protocol-platform-abstraction） */
  flashCommandSet: FlashCommandSet;
  /** ROM bank 窗口大小 (GBA: 无 bank, MBC5: 0x4000) */
  romBankSize: number;
  /** RAM bank 窗口大小 */
  ramBankSize: number;
  /** 将线性地址转为 bank+offset */
  toBank(address: number): { bank: number; offset: number };
  /** 切换 ROM bank */
  switchRomBank(device: Device, bank: number): Promise<void>;
  /** 切换 RAM bank */
  switchRamBank(device: Device, bank: number): Promise<void>;
  /** 启用 RAM 访问 */
  enableRam(device: Device): Promise<void>;
  /** 禁用 RAM 访问 */
  disableRam(device: Device): Promise<void>;
}
```

### D2: 模板方法架构

`CartridgeAdapter` 基类实现操作模板：

```
readROM():
  1. initProgress()
  2. settleBefore()
  3. for each chunk:
     a. platformOps.switchRomBank(bank)
     b. platformOps.flashCommandSet.read(addr, size)
     c. reportProgress()
  4. return result

writeROM():
  1. initProgress()
  2. sampleBlankRegions()
  3. eraseSectors()
  4. for each chunk:
     a. platformOps.switchRomBank(bank)
     b. platformOps.flashCommandSet.write(addr, data)
     c. reportProgress()
  5. verify if requested
```

子类实现:
```typescript
class GBAAdapter extends CartridgeAdapter {
  protected createPlatformOps(): PlatformOps { return GBA_PLATFORM_OPS; }
}
class MBC5Adapter extends CartridgeAdapter {
  protected createPlatformOps(): PlatformOps { return MBC5_PLATFORM_OPS; }
}
```

### D3: 进度初始化工厂

```typescript
// CartridgeAdapter 基类方法
protected createProgressContext(config: {
  operation: string;
  totalBytes: number;
  sectors?: SectorInfo[];
}): { speedCalculator: SpeedCalculator; reporter: ProgressReporter }
```

所有操作方法通过此工厂初始化进度上下文，消除 16+ 处重复的初始化套路。

### D4: PPB 解锁核心提取

```typescript
interface PPBDeviceOps {
  write(device: Device, address: number, data: Uint8Array): Promise<void>;
  read(device: Device, address: number, length: number): Promise<Uint8Array>;
  toSectorAddress(sector: number): number;
  i18nPrefix: string;
}

async function ppbUnlockCore(
  device: Device,
  ops: PPBDeviceOps,
  sectorCount: number,
  onProgress: (pct: number, msg: string) => void,
  signal: AbortSignal
): Promise<boolean>
```

`ppbUnlockGBA` 和 `ppbUnlockMBC5` 保留为提供 `PPBDeviceOps` 实现的薄包装。

### D5: 实施分批策略

本变更是项目最大的重构，建议分批实施：
1. **Phase A**: 提取 `PlatformOps` 接口和 `createProgressContext()` 工厂
2. **Phase B**: 迁移 `readROM()`/`writeROM()` 模板方法（最大单项）
3. **Phase C**: 迁移 `eraseSectors()`/`verifyROM()` 模板方法
4. **Phase D**: 迁移 RAM 操作模板方法
5. **Phase E**: 提取 PPB 解锁核心

每个 phase 完成后运行完整测试套件。

## Risks / Trade-offs

- [风险] 这是项目最大的重构项，涉及设备操作核心路径 → 分批实施，每批独立验证，需真机测试
- [风险] 模板方法可能无法覆盖所有平台差异点 → PlatformOps 接口可扩展，遇到新差异点时添加新方法
- [风险] GBA 无 bank 切换而 MBC5 有，模板方法需处理此差异 → GBA 的 `switchRomBank` 为空操作
- [取舍] 基类膨胀到 ~800-1000 行 → 虽然单文件较大，但职责统一且消除了更大量的重复
- [取舍] 保留双子类结构而非合一 → 语义更清晰，且某些平台特有操作（如 MBC5 的 bank 切换）仍需独立实现
