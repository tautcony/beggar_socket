<template>
  <div class="serial-test-view">
    <header class="page-header">
      <h1>串口测试工具</h1>
      <p class="description">
        测试统一的串口服务，支持 Web Serial API 和 Electron 原生串口
      </p>
    </header>

    <main class="main-content">
      <!-- 环境信息 -->
      <section class="environment-info">
        <h2>运行环境</h2>
        <div class="info-grid">
          <div class="info-item">
            <label>平台:</label>
            <span>{{ platformInfo.platform }}</span>
          </div>
          <div class="info-item">
            <label>用户代理:</label>
            <span>{{ platformInfo.userAgent }}</span>
          </div>
          <div class="info-item">
            <label>Electron 环境:</label>
            <span
              class="badge"
              :class="{ 'badge-success': isElectronEnv, 'badge-info': !isElectronEnv }"
            >
              {{ isElectronEnv ? '是 (原生串口)' : '否 (Web Serial API)' }}
            </span>
          </div>
          <div class="info-item">
            <label>Web Serial API 支持:</label>
            <span
              class="badge"
              :class="{ 'badge-success': hasWebSerial, 'badge-error': !hasWebSerial }"
            >
              {{ hasWebSerial ? '支持' : '不支持' }}
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
.serial-testing,
.quick-actions {
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

.action-buttons {
  display: flex;
  gap: 16px;
  margin: 16px 0;
  flex-wrap: wrap;
}

.test-button {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 160px;
}

.test-button.integration {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.test-button.performance {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.test-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.test-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.test-results {
  margin-top: 24px;
}

.test-results h3 {
  color: #333;
  margin-bottom: 12px;
}

.results-log {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 16px;
  max-height: 300px;
  overflow-y: auto;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
}

.result-item {
  display: flex;
  margin-bottom: 8px;
  padding: 4px 0;
}

.result-item.success {
  color: #28a745;
}

.result-item.error {
  color: #dc3545;
}

.result-item.warning {
  color: #ffc107;
}

.result-item.info {
  color: #17a2b8;
}

.timestamp {
  font-weight: 600;
  margin-right: 12px;
  min-width: 80px;
}

.message {
  flex: 1;
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

  .action-buttons {
    flex-direction: column;
  }

  .test-button {
    width: 100%;
  }
}
</style>
