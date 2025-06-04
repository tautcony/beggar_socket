import { modbusCRC16, modbusCRC16_lut } from '../../src/utils/crc-utils';

// 生成测试数据的辅助函数
const generateTestData = (size: number): Uint8Array => {
  const data = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    data[i] = Math.floor(Math.random() * 256);
  }
  return data;
};

// 测量函数执行时间的辅助函数
const measureTime = (func: () => void, iterations: number = 1): number => {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    func();
  }
  const end = performance.now();
  return end - start;
};

// 简单的断言函数
const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(`断言失败: ${message}`);
  }
};

// 测试数据大小
const testSizes = [1024, 4096, 16384, 65536, 262144]; // 1KB, 4KB, 16KB, 64KB, 256KB, 1MB
const iterations = 1000;

// 性能测试结果
const performanceResults: Array<{
  size: number
  originalTime: number
  lutTime: number
  speedup: number
  improvement: number
}> = [];

// 运行性能测试
const runPerformanceTest = () => {
  console.log('🧪 开始CRC16性能测试');
  console.log('=====================================');

  testSizes.forEach(size => {
    console.log(`\n🔄 正在测试 ${size} 字节数据...`);

    const testData = generateTestData(size);

    // 预热运行，避免JIT编译影响
    for (let i = 0; i < 100; i++) {
      modbusCRC16(testData);
      modbusCRC16_lut(testData);
    }

    // 测试原始实现
    const originalTime = measureTime(() => {
      modbusCRC16(testData);
    }, iterations);

    // 测试查表实现
    const lutTime = measureTime(() => {
      modbusCRC16_lut(testData);
    }, iterations);

    const speedup = originalTime / lutTime;
    const improvement = ((originalTime - lutTime) / originalTime) * 100;

    performanceResults.push({
      size,
      originalTime,
      lutTime,
      speedup,
      improvement,
    });

    console.log(`📊 数据大小: ${size} 字节`);
    console.log(`🐌 原始实现: ${(originalTime / iterations).toFixed(4)}ms (平均)`);
    console.log(`🚀 查表实现: ${(lutTime / iterations).toFixed(4)}ms (平均)`);
    console.log(`📈 性能提升: ${speedup.toFixed(2)}x (${improvement.toFixed(1)}% 更快)`);

    // 验证查表法确实更快（对于大数据）
    if (size >= 1024) {
      assert(lutTime < originalTime, `查表实现应该比原始实现更快 (数据大小: ${size} 字节)`);
    }

    // 验证性能提升合理性
    assert(speedup > 0, `性能提升应该大于0 (当前: ${speedup})`);

    console.log('✅ 测试通过');
  });

  // 性能总结
  console.log('\n🎯 性能测试总结');
  console.log('=====================================');

  const avgSpeedup = performanceResults.reduce((sum, r) => sum + r.speedup, 0) / performanceResults.length;
  const maxSpeedup = Math.max(...performanceResults.map(r => r.speedup));
  const minSpeedup = Math.min(...performanceResults.map(r => r.speedup));

  console.log(`平均性能提升: ${avgSpeedup.toFixed(2)}x`);
  console.log(`最大性能提升: ${maxSpeedup.toFixed(2)}x`);
  console.log(`最小性能提升: ${minSpeedup.toFixed(2)}x`);

  // 显示详细结果表格
  console.table(performanceResults.map(r => ({
    '数据大小(字节)': r.size,
    '原始实现(ms)': (r.originalTime / iterations).toFixed(4),
    '查表实现(ms)': (r.lutTime / iterations).toFixed(4),
    '速度提升': `${r.speedup.toFixed(2)}x`,
    '性能改善': `${r.improvement.toFixed(1)}%`,
  })));
};

// 如果直接运行此文件，则执行性能测试
if (typeof window === 'undefined' && typeof global !== 'undefined') {
  // Node.js 环境
  runPerformanceTest();
} else {
  // 浏览器环境，导出函数供外部调用
  (globalThis as { runCRC16PerformanceTest?: () => void }).runCRC16PerformanceTest = runPerformanceTest;
}

export { runPerformanceTest };
