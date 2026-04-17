## 1. 描述符映射表

- [ ] 1.1 定义 `SettingDescriptor` 接口
- [ ] 1.2 创建描述符数组，覆盖全部 16 个配置属性的 key、group、field、default、validator
- [ ] 1.3 为每个描述符编写 validator 函数（min/max clamp 逻辑）

## 2. 自动 getter/setter 注册

- [ ] 2.1 编写 `registerProperties()` 工具函数，遍历描述符并用 Object.defineProperty 注册
- [ ] 2.2 在类初始化时调用 `registerProperties()`
- [ ] 2.3 删除 16 组手写 getter/setter 代码
- [ ] 2.4 保留 TypeScript 属性声明以确保类型安全

## 3. validateSettings 重构

- [ ] 3.1 用描述符数组驱动的循环替代 20+ 个手写验证块
- [ ] 3.2 验证输出 SHALL 与旧版逐属性一致

## 4. 验证

- [ ] 4.1 运行 `npm run type-check`
- [ ] 4.2 运行 `npm run test:run`
- [ ] 4.3 手动验证 AdvancedSettings 面板交互行为不变
