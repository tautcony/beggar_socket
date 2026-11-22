# Tasks

## 1. 存储与迁移

- [ ] 1.1 将 core ParameterStore 接到 v2 namespace persistence，实现迁移、schema 校验和兼容入口。设置测试覆盖作用域、STM/Boost 共用值、STM/STC 联动、GBFlash 独立值和既有范围与规范化规则。
- [ ] 1.2 实现 `advanced_settings` v2 迁移。使用测试夹具覆盖旧选择、`stmBoost` 缺省 / `true` / `false`、`size`、`profileSizes`、波特率、节流、重试、超时、未知版本、损坏 JSON 与重复加载。旧 STM 选项统一迁移为标准丐中丐，不写入一次性弹窗标记；迁移时尽力备份 v1（失败忽略）并写入 v2。
- [ ] 1.3 按连接或操作边界应用参数。集成测试验证修改设备、固件或波特率后当前会话继续工作，重连应用新选择，后续读写按新操作参数起始快照运行。

## 2. 高级设置与操作界面

- [ ] 2.1 在 `AdvancedSettingsModal.vue` 使用注册定义列出四个选项，以 schema 渲染设置并显示活动会话和重连提示。组件测试覆盖四个选项、共用封包设置、GBFlash 波特率和 `0x2000` 编辑上限，检查五种语言。
- [ ] 2.2 将 CartBurner、ChipOperations、RamOperations、工具和调试入口（含 `services/tool-functions.ts` 的 `isFlashgbxDevice` 分支）接到 core 能力矩阵。验证未声明能力的提示与执行拦截，以及 RTC、PPB、FRAM、震动、电源和烧录卡 profile 的既有行为；FlashGBX 的 PPB/debug 按矩阵保持不可用，RTC 按矩阵保持可用（具体实现待完善）。
- [ ] 2.3 将烧录卡 profile 的采用和筛选改用数据库能力。运行 profile 集成测试，验证模式列表、歧义、AUDIO/VIN 与电压校验。

## 3. 兼容清理与集成

- [ ] 3.1 迁移剩余调用者并移除旧固件身份判断和专用别名，清除旧未知设备的宽松兜底。用定向源码检查、类型检查及能力回归确认旧路由字段无剩余活动消费者。
- [ ] 3.2 在 core → lifecycle → parameters/UI 顺序完成后验证从旧版设置启动、保存独立 Boost 选项、连接和重连的整条链路，运行 `npm run type-check`、`npm run check:deps` 和 `npm run test:run`。

