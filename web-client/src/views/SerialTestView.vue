<template>
  <div class="serial-test-view">
    <header class="page-header">
      <h1>{{ $t('ui.serialTest.title') }}</h1>
      <p class="description">
        {{ $t('ui.serialTest.description') }}
      </p>
    </header>

    <main class="main-content">
      <!-- 环境信息 -->
      <section class="environment-info">
        <h2>{{ $t('ui.serialTest.environment') }}</h2>
        <div class="info-grid">
          <div class="info-item">
            <label>{{ $t('ui.serialTest.platform') }}</label>
            <span>{{ platformInfo.platform }}</span>
          </div>
          <div class="info-item">
            <label>{{ $t('ui.serialTest.userAgent') }}</label>
            <span>{{ platformInfo.userAgent }}</span>
          </div>
          <div class="info-item">
            <label>{{ $t('ui.serialTest.electronEnv') }}</label>
            <span
              class="badge"
              :class="{ 'badge-success': isElectronEnv, 'badge-info': !isElectronEnv }"
            >
              {{ isElectronEnv ? `${$t('ui.serialTest.yes')} (${$t('ui.serialTest.nativeSerial')})` : `${$t('ui.serialTest.no')} (${$t('ui.serialTest.webSerialApi')})` }}
            </span>
          </div>
          <div class="info-item">
            <label>{{ $t('ui.serialTest.webSerialSupport') }}</label>
            <span
              class="badge"
              :class="{ 'badge-success': hasWebSerial, 'badge-error': !hasWebSerial }"
            >
              {{ hasWebSerial ? $t('ui.serialTest.supported') : $t('ui.serialTest.notSupported') }}
            </span>
          </div>
        </div>
      </section>

      <!-- 串口测试组件 -->
      <section class="serial-testing">
        <SerialTest />
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

import SerialTest from '@/components/SerialTest.vue';
import { isElectron } from '@/utils/electron';

// 响应式数据
const isElectronEnv = ref(isElectron());
const hasWebSerial = ref(false);
const testRunning = ref(false);
const testResults = ref<{ timestamp: string; message: string; type: 'info' | 'success' | 'error' | 'warning' }[]>([]);

const platformInfo = ref({
  platform: 'Unknown',
  userAgent: navigator.userAgent,
});

// 方法
const addTestResult = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
  testResults.value.push({
    timestamp: new Date().toLocaleTimeString(),
    message,
    type,
  });
};

const runPerformanceTest = async () => {
  if (testRunning.value) return;

  testRunning.value = true;
  addTestResult('开始性能测试...', 'info');

  try {
    // 模拟性能测试
    const start = performance.now();

    // 模拟一些串口操作
    addTestResult('测试数据传输性能...', 'info');

    // 模拟延迟
    await new Promise(resolve => setTimeout(resolve, 1000));

    const end = performance.now();
    const duration = Math.round(end - start);

    addTestResult(`性能测试完成 - 耗时: ${duration}ms`, 'success');

    if (isElectronEnv.value) {
      addTestResult('Electron 环境：原生串口性能更佳', 'info');
    } else {
      addTestResult('Web 环境：使用 Web Serial API', 'info');
    }

  } catch (error) {
    addTestResult(`性能测试失败: ${(error as Error).message}`, 'error');
  } finally {
    testRunning.value = false;
  }
};

const clearTestResults = () => {
  testResults.value = [];
};

// 生命周期
onMounted(async () => {
  // 检测 Web Serial API 支持
  hasWebSerial.value = 'serial' in navigator;

  // 获取平台信息
  if (isElectronEnv.value && window.electronAPI) {
    try {
      platformInfo.value.platform = await window.electronAPI.getPlatform();
    } catch (error) {
      console.warn('Failed to get platform info:', error);
    }
  } else {
    platformInfo.value.platform = navigator.userAgent || 'Web';
  }

  addTestResult('串口测试工具已初始化', 'success');
  addTestResult(`运行环境: ${isElectronEnv.value ? 'Electron (原生串口)' : 'Web (Web Serial API)'}`, 'info');
});
</script>

<style scoped>
.serial-test-view {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: var(--space-5);
}

.page-header {
  text-align: center;
  color: white;
  margin-bottom: var(--space-8);
}

.page-header h1 {
  font-size: var(--font-size-5xl);
  margin-bottom: var(--space-2-5);
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
}

.description {
  font-size: var(--font-size-lg);
  opacity: 0.9;
}

.main-content {
  max-width: 1200px;
  margin: 0 auto;
}

.environment-info,
.serial-testing {
  background: var(--color-bg);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  margin-bottom: var(--space-6);
  box-shadow: var(--shadow-md);
}

.environment-info h2,
.quick-actions h2 {
  margin-top: 0;
  color: var(--color-text);
  border-bottom: 2px solid #667eea;
  padding-bottom: var(--space-2);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--space-4);
  margin-top: var(--space-4);
}

.info-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.info-item label {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  min-width: 120px;
}

.badge {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-base);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.badge-success {
  background-color: var(--color-success-light);
  color: var(--color-success);
  border: 1px solid #c3e6cb;
}

.badge-info {
  background-color: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}

.badge-error {
  background-color: var(--color-error-light);
  color: var(--color-error);
  border: 1px solid #f5c6cb;
}
</style>
