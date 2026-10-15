# GBA ROM 回归脚本

在 `web-client` 中安装依赖后运行。脚本使用已安装的 `gbats`、软件帧缓冲，以及项目当前的 `gbats-arm-compat.ts` 和 `gba-save-bridge.ts`；无需启动浏览器或开发服务器，也无需新增依赖。

## GOODBOY 崩溃回归

```bash
npm run test:gba-rom -- --rom '/path/to/GOODBOY (Europe).rom' --scenario goodboy
```

`goodboy` 保留本次诊断使用的操作序列：等待 300 帧 → A 确认语言 → 等待及 Start/A 推进 → 开场对话 → 连续 A → 向右移动并间歇按 A，共 12,300 帧。原始测试 ROM 的 SHA-256 为 `abb7309ef1ff42618b348c28ac73615b534b18a2532d03b0718a4ff4772f6706`。其他版本、已有存档或不同语言可能需要调整输入时机。

脚本默认应用项目的 CPU 兼容修复。需要复现上游的 `Invalid user mode passed to selectBank` 时，加 `--without-arm-compat`；该诊断运行预期以非零状态退出，并保留失败截图、CPU 状态和已完成的存档检查点。

```bash
npm run test:gba-rom -- --rom '/path/to/GOODBOY (Europe).rom' \
  --scenario goodboy --without-arm-compat --out /tmp/goodboy-baseline
```

## SAV 加载与复用

将上一次输出的 `output.sav` 传给下一次运行：

```bash
npm run test:gba-rom -- --rom '/path/to/GOODBOY (Europe).rom' \
  --scenario goodboy --out /tmp/goodboy-first

npm run test:gba-rom -- --rom '/path/to/GOODBOY (Europe).rom' \
  --sav /tmp/goodboy-first/output.sav --scenario goodboy-reload \
  --out /tmp/goodboy-reload
```

`goodboy-reload` 运行 3,300 帧：等待 300 帧，再重复 50 次短按 A 并推进 60 帧。导入后会立即逐字节验证整个输入都保留在输出中；短文件允许后面按核心窗口规范化补齐。`importExactMatch` 另表示捕获与输入是否等长且完全相同。导出后会创建新的内核，重新导入并逐字节验证完整输出。

## 其他 ROM

```bash
npm run test:gba-rom -- --rom '/path/to/game.gba' --frames 600
npm run test:gba-rom -- --rom '/path/to/game.gba' --sav '/path/to/game.sav' --frames 600
npm run test:gba-rom -- --help
```

默认 `boot` 场景不输入按键，运行 300 帧；`--frames` 仅调整此场景。SRAM、Flash 和 EEPROM 使用与应用相同的原生硬件窗口和协议稳定性规则。任何非空 raw SAV 长度都可导入：内核只收到可寻址前缀，完整镜像单独保留；窗口之外的尾部在 checkpoint、导出及重载时保持原样。短于硬件窗口的输入按初始内核 backing 补齐。报告中的 `importMatches`/`importPrefixMatches` 比较输入的全部字节，`importExactMatch` 表示捕获与输入是否等长且逐字节相同。无法识别存档类型的 ROM 只验证启动，不导出 SAV；EEPROM 未通过 runtime 或导入提示确定窗口、或存档写入未稳定时，导出会按桥接规则报错。

## 结果

默认写入被 Git 忽略的 `web-client/artifacts/gba-rom-<时间>/`。可以用 `--out` 指定新的目录；已有目录会被拒绝，避免覆盖先前结果或输入文件。ROM 和输入 SAV 只读，不会拷入仓库。

- `report.json`：完成帧数、画面帧数、存档类型、CPU 掩码、WARN 次数和样本、ERROR、检查点数量、输入/输出 SHA-256、导入与导出重载校验、输入文件是否保持不变。
- `language.png`、`dialogue.png`、`after-dialogue.png`、`moving-right.png`：GOODBOY 阶段截图；其他场景输出 `final.png`。
- `output.sav`：成功运行后的稳定存档。
- `failure.png`、`last-checkpoint.sav`：失败时的画面和可用的最后稳定检查点。

成功退出码为 `0`；内核 ERROR、执行异常或存档校验失败为 `1`。WARN 保留在报告中但不会终止执行。`passed` 表示脚本执行和存档检查通过；游戏是否到达预期画面需查看截图。本脚本验证真实内核，浏览器交互、音频和 Tauri 文件对话框仍需单独验收。
