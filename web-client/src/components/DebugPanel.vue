<template>
  <div 
    v-if="showDebugPanel"
    class="debug-panel"
  >
    <div class="debug-header">
      <h3>🛠️ 调试控制面板</h3>
      <button 
        class="debug-toggle"
        @click="togglePanel"
      >
        {{ panelCollapsed ? '展开' : '收起' }}
      </button>
    </div>
    
    <div 
      v-show="!panelCollapsed"
      class="debug-content"
    >
      <!-- 调试模式开关 -->
      <div class="debug-section">
        <label class="debug-switch">
          <input 
            v-model="debugEnabled"
            type="checkbox"
            @change="onDebugToggle"
          >
          <span class="slider">启用调试模式</span>
        </label>
      </div>

      <!-- 模拟设置 -->
      <div 
        v-if="debugEnabled"
        class="debug-section"
      >
        <h4>模拟设置</h4>
        
        <div class="debug-control">
          <label>延迟时间 (ms):</label>
          <input 
            v-model.number="simulatedDelay"
            type="number"
            min="0"
            max="5000"
            step="100"
            @change="updateDelay"
          >
        </div>

        <div class="debug-control">
          <label>进度更新间隔 (ms):</label>
          <input 
            v-model.number="progressInterval"
            type="number"
            min="50"
            max="1000"
            step="50"
            @change="updateProgressInterval"
          >
        </div>

        <div class="debug-control">
          <label class="debug-switch">
            <input 
              v-model="simulateErrors"
              type="checkbox"
              @change="updateErrorSimulation"
            >
            <span class="slider">模拟错误</span>
          </label>
        </div>

        <div 
          v-if="simulateErrors"
          class="debug-control"
        >
          <label>错误概率:</label>
          <input 
            v-model.number="errorProbability"
            type="range"
            min="0"
            max="1"
            step="0.1"
            @change="updateErrorProbability"
          >
          <span class="debug-value">{{ (errorProbability * 100).toFixed(0) }}%</span>
        </div>
      </div>

      <!-- 快捷操作 -->
      <div 
        v-if="debugEnabled"
        class="debug-section"
      >
        <h4>快捷操作</h4>
        <div class="debug-buttons">
          <button 
            class="debug-btn"
            @click="connectMockDevice"
          >
            连接模拟设备
          </button>
          <button 
            class="debug-btn"
            @click="generateTestRom"
          >
            生成测试ROM
          </button>
          <button 
            class="debug-btn"
            @click="generateTestRam"
          >
            生成测试RAM
          </button>
          <button 
            class="debug-btn secondary"
            @click="clearMockData"
          >
            清除模拟数据
          </button>
        </div>
      </div>

      <!-- 状态信息 -->
      <div class="debug-section">
        <h4>状态信息</h4>
        <div class="debug-status">
          <div class="status-item">
            <span class="status-label">调试模式:</span>
            <span :class="['status-value', debugEnabled ? 'active' : 'inactive']">
              {{ debugEnabled ? '启用' : '禁用' }}
            </span>
          </div>
          <div class="status-item">
            <span class="status-label">模拟延迟:</span>
            <span class="status-value">{{ simulatedDelay }}ms</span>
          </div>
          <div class="status-item">
            <span class="status-label">错误模拟:</span>
            <span class="status-value">{{ simulateErrors ? `${(errorProbability * 100).toFixed(0)}%` : '关闭' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { DebugConfig } from '@/utils/DebugConfig'

const emit = defineEmits(['connect-mock-device', 'generate-test-file'])

// 面板状态
const showDebugPanel = ref(false)
const panelCollapsed = ref(true)

// 调试设置
const debugEnabled = ref(false)
const simulatedDelay = ref(1000)
const progressInterval = ref(100)
const simulateErrors = ref(false)
const errorProbability = ref(0.1)

onMounted(() => {
  // 检查是否应该显示调试面板
  showDebugPanel.value = import.meta.env.VITE_DEBUG_MODE === 'true'
  
  // 同步调试配置
  syncConfig()
})

function syncConfig() {
  debugEnabled.value = DebugConfig.enabled
  simulatedDelay.value = DebugConfig.simulatedDelay
  progressInterval.value = DebugConfig.progressUpdateInterval
  simulateErrors.value = DebugConfig.simulateErrors
  errorProbability.value = DebugConfig.errorProbability
}

function togglePanel() {
  panelCollapsed.value = !panelCollapsed.value
}

function onDebugToggle() {
  DebugConfig.enabled = debugEnabled.value
  if (debugEnabled.value) {
    console.log('🎭 调试模式已启用')
  } else {
    console.log('🎭 调试模式已禁用')
  }
}

function updateDelay() {
  DebugConfig.simulatedDelay = simulatedDelay.value
}

function updateProgressInterval() {
  DebugConfig.progressUpdateInterval = progressInterval.value
}

function updateErrorSimulation() {
  DebugConfig.simulateErrors = simulateErrors.value
}

function updateErrorProbability() {
  DebugConfig.errorProbability = errorProbability.value
}

function connectMockDevice() {
  emit('connect-mock-device')
}

function generateTestRom() {
  // 生成2MB的测试ROM数据
  const testData = DebugConfig.generateRandomData(0x200000)
  const blob = new Blob([testData], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'test_rom.gba'
  a.click()
  URL.revokeObjectURL(url)
}

function generateTestRam() {
  // 生成32KB的测试RAM数据
  const testData = DebugConfig.generateRandomData(0x8000)
  const blob = new Blob([testData], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'test_ram.sav'
  a.click()
  URL.revokeObjectURL(url)
}

function clearMockData() {
  console.log('🗑️ 清除模拟数据')
  // 这里可以添加清除模拟数据的逻辑
}
</script>

<style scoped>
.debug-panel {
  position: fixed;
  top: 20px;
  left: 20px;
  width: 320px;
  max-height: 80vh;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border: 2px solid #ff9800;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  color: #333;
  font-family: 'Segoe UI', 'PingFang SC', Arial, sans-serif;
  overflow: hidden;
  transition: all 0.3s ease;
}

.debug-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, #ff9800, #f57c00);
  border-radius: 10px 10px 0 0;
  position: relative;
}

.debug-header::before {
  /* content: '🚧'; */
  position: absolute;
  left: -8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 20px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.debug-header h3 {
  margin: 0;
  font-size: 16px;
  color: white;
  text-shadow: 0 1px 2px rgba(0,0,0,0.3);
}

.debug-toggle {
  background: rgba(255, 255, 255, 0.9);
  color: #ff9800;
  border: 1px solid rgba(255, 152, 0, 0.3);
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.debug-toggle:hover {
  background: white;
  color: #f57c00;
  border-color: #f57c00;
  transform: translateY(-1px);
}

.debug-content {
  padding: 16px;
  max-height: 60vh;
  overflow-y: auto;
  background: rgba(248, 249, 250, 0.8);
}

.debug-section {
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #e9ecef;
}

.debug-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.debug-section h4 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #495057;
  font-weight: 600;
}

.debug-switch {
  display: flex;
  align-items: center;
  cursor: pointer;
  margin-bottom: 8px;
}

.debug-switch input {
  margin-right: 8px;
}

.debug-control {
  margin-bottom: 12px;
}

.debug-control label {
  display: block;
  margin-bottom: 4px;
  font-size: 13px;
  color: #6c757d;
  font-weight: 500;
}

.debug-control input[type="number"],
.debug-control input[type="range"] {
  width: 80%;
  padding: 6px 10px;
  border: 1px solid #ced4da;
  border-radius: 6px;
  background: white;
  color: #495057;
  font-size: 12px;
  transition: border-color 0.2s ease;
}

.debug-control input[type="number"]:focus,
.debug-control input[type="range"]:focus {
  outline: none;
  border-color: #ff9800;
  box-shadow: 0 0 0 2px rgba(255, 152, 0, 0.1);
}

.debug-control input[type="range"] {
  padding: 0;
}

.debug-value {
  margin-left: 8px;
  font-size: 12px;
  color: #ff9800;
  font-weight: 600;
}

.debug-hint {
  font-size: 12px;
  color: #6c757d;
  margin: 8px 0 0 0;
  background: rgba(108, 117, 125, 0.1);
  padding: 6px 8px;
  border-radius: 4px;
  border-left: 3px solid #ff9800;
}

.debug-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.debug-btn {
  padding: 8px 12px;
  border: 1px solid #28a745;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  background: #28a745;
  color: white;
  transition: all 0.2s ease;
}

.debug-btn:hover {
  background: #218838;
  border-color: #218838;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);
}

.debug-btn.secondary {
  background: #dc3545;
  border-color: #dc3545;
}

.debug-btn.secondary:hover {
  background: #c82333;
  border-color: #c82333;
  box-shadow: 0 2px 8px rgba(220, 53, 69, 0.3);
}

.debug-status {
  font-size: 12px;
  background: rgba(248, 249, 250, 0.5);
  padding: 10px;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.status-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  padding: 2px 0;
}

.status-label {
  color: #6c757d;
  font-weight: 500;
}

.status-value {
  color: #495057;
  font-weight: 600;
}

.status-value.active {
  color: #28a745;
}

.status-value.inactive {
  color: #6c757d;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .debug-panel {
    position: fixed;
    top: 10px;
    left: 10px;
    right: 10px;
    width: auto;
    max-width: none;
  }
  
  .debug-buttons {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .debug-panel {
    top: 5px;
    left: 5px;
    right: 5px;
    font-size: 13px;
  }
  
  .debug-header h3 {
    font-size: 14px;
  }
  
  .debug-content {
    padding: 12px;
  }
}
</style>
