import { modbusCRC16, modbusCRC16_lut } from './ProtocolUtils';

export class CRC16PerformanceTest {
  /**
   * 生成指定大小的随机测试数据
   */
  private static generateTestData(size: number): Uint8Array {
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      data[i] = Math.floor(Math.random() * 256);
    }
    return data;
  }

  /**
   * 测试单个函数的性能
   */
  private static measurePerformance(
    func: (data: Uint8Array) => number,
    data: Uint8Array,
    iterations: number = 1000
  ): { averageTime: number; totalTime: number; result: number } {
    let result = 0;
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      result = func(data);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const averageTime = totalTime / iterations;

    return { averageTime, totalTime, result };
  }

  /**
   * 验证两个函数结果是否一致
   */
  private static verifyResults(data: Uint8Array): boolean {
    const result1 = modbusCRC16(data);
    const result2 = modbusCRC16_lut(data);
    return result1 === result2;
  }

  /**
   * 运行性能测试
   */
  public static runPerformanceTest(): void {
    console.log('🧪 CRC16 性能测试开始');
    console.log('=====================================');

    // 测试不同大小的数据
    const testSizes = [16, 64, 256, 1024, 4096, 16384, 65536];
    const iterations = 1000;

    for (const size of testSizes) {
      console.log(`\n📊 测试数据大小: ${size} 字节`);
      console.log('-------------------------------------');

      const testData = this.generateTestData(size);

      // 验证结果一致性
      const isCorrect = this.verifyResults(testData);
      console.log(`✅ 结果一致性: ${isCorrect ? '通过' : '❌ 失败'}`);

      if (!isCorrect) {
        console.error('❌ 两个函数返回结果不一致！');
        continue;
      }

      // 测试原始实现
      const originalResult = this.measurePerformance(modbusCRC16, testData, iterations);
      console.log(`🐌 原始实现 (循环): ${originalResult.averageTime.toFixed(4)}ms (平均)`);
      console.log(`   总时间: ${originalResult.totalTime.toFixed(2)}ms`);
      console.log(`   CRC值: 0x${originalResult.result.toString(16).toUpperCase().padStart(4, '0')}`);

      // 测试查表实现
      const lutResult = this.measurePerformance(modbusCRC16_lut, testData, iterations);
      console.log(`🚀 查表实现 (LUT): ${lutResult.averageTime.toFixed(4)}ms (平均)`);
      console.log(`   总时间: ${lutResult.totalTime.toFixed(2)}ms`);
      console.log(`   CRC值: 0x${lutResult.result.toString(16).toUpperCase().padStart(4, '0')}`);

      // 计算性能提升
      const speedup = originalResult.averageTime / lutResult.averageTime;
      const improvement = ((originalResult.averageTime - lutResult.averageTime) / originalResult.averageTime * 100);

      console.log(`📈 性能提升: ${speedup.toFixed(2)}x (${improvement.toFixed(1)}% 更快)`);

      if (speedup > 1) {
        console.log(`💡 查表法比原始实现快 ${speedup.toFixed(2)} 倍`);
      } else {
        console.log(`⚠️  查表法反而慢了 ${(1/speedup).toFixed(2)} 倍`);
      }
    }

    console.log('\n🎯 性能测试总结');
    console.log('=====================================');
    console.log('查表法 (LUT) 的优势：');
    console.log('• 避免了内层8次循环');
    console.log('• 使用预计算的表直接查找');
    console.log('• 对大数据量性能提升明显');
    console.log('\n注意：小数据量时两者差异可能不明显，甚至查表法可能因为额外的数组访问而稍慢');
  }

  /**
   * 测试极端情况
   */
  public static runExtremeCases(): void {
    console.log('\n🔬 极端情况测试');
    console.log('=====================================');

    // 测试空数据
    const emptyData = new Uint8Array(0);
    console.log(`空数据 - 原始: 0x${modbusCRC16(emptyData).toString(16).toUpperCase()}`);
    console.log(`空数据 - 查表: 0x${modbusCRC16_lut(emptyData).toString(16).toUpperCase()}`);

    // 测试单字节
    const singleByte = new Uint8Array([0x55]);
    console.log(`单字节(0x55) - 原始: 0x${modbusCRC16(singleByte).toString(16).toUpperCase()}`);
    console.log(`单字节(0x55) - 查表: 0x${modbusCRC16_lut(singleByte).toString(16).toUpperCase()}`);

    // 测试全0
    const zeroData = new Uint8Array(1024).fill(0);
    console.log(`全0数据 - 原始: 0x${modbusCRC16(zeroData).toString(16).toUpperCase()}`);
    console.log(`全0数据 - 查表: 0x${modbusCRC16_lut(zeroData).toString(16).toUpperCase()}`);

    // 测试全FF
    const ffData = new Uint8Array(1024).fill(0xFF);
    console.log(`全FF数据 - 原始: 0x${modbusCRC16(ffData).toString(16).toUpperCase()}`);
    console.log(`全FF数据 - 查表: 0x${modbusCRC16_lut(ffData).toString(16).toUpperCase()}`);
  }

  /**
   * 运行完整测试套件
   */
  public static runFullTest(): void {
    this.runPerformanceTest();
    this.runExtremeCases();
  }
}

// 如果直接运行此文件，执行测试
if (typeof window !== 'undefined') {
  // 浏览器环境
  console.log('在浏览器控制台运行 CRC16PerformanceTest.runFullTest() 来执行测试');
} else {
  // Node.js环境
  CRC16PerformanceTest.runFullTest();
}
