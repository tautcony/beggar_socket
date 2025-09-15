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
  padding: 20px;
}

.page-header {
  text-align: center;
  color: white;
  margin-bottom: 30px;
}

.page-header h1 {
  font-size: 2.5rem;
  margin-bottom: 10px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
}

.description {
  font-size: 1.1rem;
  opacity: 0.9;
}

.main-content {
  max-width: 1200px;
  margin: 0 auto;
}

.environment-info,
.serial-testing {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.environment-info h2,
.quick-actions h2 {
  margin-top: 0;
  color: #333;
  border-bottom: 2px solid #667eea;
  padding-bottom: 8px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-item label {
  font-weight: 600;
  color: #555;
  min-width: 120px;
}

.badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
}

.badge-success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.badge-info {
  background-color: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}

.badge-error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .serial-test-view {
    padding: 10px;
  }

  .page-header h1 {
    font-size: 2rem;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
