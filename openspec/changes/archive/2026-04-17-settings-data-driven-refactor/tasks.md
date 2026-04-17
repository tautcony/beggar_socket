## 1. 描述符映射表

- [x] 1.1 定义 `SettingDescriptor` 接口
- [x] 1.2 创建描述符数组，覆盖全部 16 个配置属性的 key、group、field、default、validator
- [x] 1.3 为每个描述符编写 validator 函数（min/max clamp 逻辑）

## 2. 自动 getter/setter 注册

- [x] 2.1 编写 `registerProperties()` 工具函数，遍历描述符并用 Object.defineProperty 注册
- [x] 2.2 在类初始化时调用 `registerProperties()`
- [x] 2.3 删除 16 组手写 getter/setter 代码
- [x] 2.4 保留 TypeScript 属性声明以确保类型安全

## 3. validateSettings 重构

- [x] 3.1 用描述符数组驱动的循环替代 20+ 个手写验证块
- [x] 3.2 验证输出 SHALL 与旧版逐属性一致

## 4. 补充测试

- [x] 4.1 为每个描述符覆盖 getter 返回默认值、setter clamp 边界、validateSettings 修正越界值的测试用例
- [x] 4.2 确保 `advanced-settings.test.ts` 覆盖全部 16 个配置属性的 get/set/validate

## 5. 验证

- [x] 5.1 运行 `npm run type-check`
- [x] 5.2 运行 `npm run test:run`
- [x] 5.3 运行 `npm run lint`
- [x] 5.4 运行 `npm run build`
