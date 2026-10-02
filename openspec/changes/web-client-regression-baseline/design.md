## Context

两个 8 MiB ROM 经通用深比较占用超过显式 15 秒测试预算。当前 CI 主要打包，未运行单测。

## Goals / Non-Goals

Goals：保留精确字节断言与输入不变性，建立质量 job。Non-Goals：不放宽全局 timeout，不改变产品输出或硬件构建。

## Decisions

- 测试使用 Node Buffer.equals 的精确线性比较，并验证不同长度、首/中/尾单字节差异会失败。独立测试 helper 不进入浏览器 bundle。
- 独立 quality workflow 使用 Node 24.19.0/npm 11.19.0，在 PR/main push 执行现有命令；Pages build 等待本工作流内质量 job，打包前执行测试。
- 分两次提交：先测试基线，再质量门禁。所有代码提交带行为测试。

## Risks / Trade-offs

- 大型输出比较可能只报告布尔失败：helper 在失败时给出长度或首个差异位置。
- CI 实际运行仍依赖远端：本地执行相同门禁并测试工作流结构，远端运行不作本地通过声明。
