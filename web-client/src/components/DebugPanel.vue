<template>
  <div
    v-if="showDebugPanel"
    class="debug-panel"
  >
    <div class="debug-header">
      <h3>
        <IonIcon
          :icon="constructOutline"
          style="vertical-align: middle; margin-right: 6px; font-size: 1.2em;"
        />
        {{ $t('ui.debug.title') }}
      </h3>
    </div>

    <div
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
          <span class="slider">{{ $t('ui.debug.enableDebugMode') }}</span>
        </label>
      </div>

      <!-- 模拟设置 -->
      <div
        v-if="debugEnabled"
        class="debug-section"
      >
        <h4>{{ $t('ui.debug.simulationSettings') }}</h4>

        <div class="debug-control">
          <label>{{ $t('ui.debug.delayTime') }}:</label>
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
          <label>{{ $t('ui.debug.progressInterval') }}:</label>
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
            <span class="slider">{{ $t('ui.debug.simulateErrors') }}</span>
          </label>
        </div>

        <div
          v-if="simulateErrors"
          class="debug-control"
        >
          <label>{{ $t('ui.debug.errorProbability') }}:</label>
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
        <h4>{{ $t('ui.debug.quickActions') }}</h4>
        <div class="debug-buttons">
          <button
            class="debug-btn"
            @click="connectMockDevice"
          >
            {{ $t('ui.debug.connectMockDevice') }}
          </button>
          <button
            class="debug-btn"
            @click="generateTestRom"
          >
            {{ $t('ui.debug.generateTestRom') }}
          </button>
          <button
            class="debug-btn"
            @click="generateTestRam"
          >
            {{ $t('ui.debug.generateTestRam') }}
          </button>
          <button
            class="debug-btn secondary"
            @click="clearMockData"
          >
            {{ $t('ui.debug.clearMockData') }}
          </button>
        </div>
      </div>

      <!-- 状态信息 -->
      <div class="debug-section">
        <h4>{{ $t('ui.debug.statusInfo') }}</h4>
        <div class="debug-status">
          <div class="status-item">
            <span class="status-label">{{ $t('ui.debug.debugMode') }}:</span>
            <span :class="['status-value', debugEnabled ? 'active' : 'inactive']">
              {{ debugEnabled ? $t('ui.debug.enabled') : $t('ui.debug.disabled') }}
            </span>
          </div>
          <div class="status-item">
            <span class="status-label">{{ $t('ui.debug.simulatedDelay') }}:</span>
            <span class="status-value">{{ simulatedDelay }}ms</span>
          </div>
          <div class="status-item">
            <span class="status-label">{{ $t('ui.debug.errorSimulation') }}:</span>
            <span class="status-value">{{ simulateErrors ? `${(errorProbability * 100).toFixed(0)}%` : $t('ui.debug.off') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { constructOutline } from 'ionicons/icons';
import { onMounted, ref } from 'vue';

import { DebugSettings } from '@/settings/debug-settings';
import { GBA_NINTENDO_LOGO } from '@/utils/rom-parser';

const emit = defineEmits<{
  'connect-mock-device': [];
  'generate-test-file': [];
  'clear-mock-data': [];
}>();

// 面板状态
const showDebugPanel = ref(false);

// 调试设置
const debugEnabled = ref(false);
const simulatedDelay = ref(1000);
const progressInterval = ref(100);
const simulateErrors = ref(false);
const errorProbability = ref(0.1);

onMounted(() => {
  // 检查是否应该显示调试面板 - 使用 DebugSettings 的统一逻辑
  showDebugPanel.value = DebugSettings.showDebugPanel || import.meta.env.DEV;

  // 同步调试配置
  syncConfig();
});

function syncConfig() {
  debugEnabled.value = DebugSettings.debugMode;
  simulatedDelay.value = DebugSettings.simulatedDelay;
  progressInterval.value = DebugSettings.progressUpdateInterval;
  simulateErrors.value = DebugSettings.simulateErrors;
  errorProbability.value = DebugSettings.errorProbability;
}

function onDebugToggle() {
  DebugSettings.debugMode = debugEnabled.value;
  if (debugEnabled.value) {
    console.log('[DEBUG] 调试模式已启用');
  } else {
    console.log('[DEBUG] 调试模式已禁用');
  }
}

function updateDelay() {
  DebugSettings.simulatedDelay = simulatedDelay.value;
}

function updateProgressInterval() {
  DebugSettings.progressUpdateInterval = progressInterval.value;
}

function updateErrorSimulation() {
  DebugSettings.simulateErrors = simulateErrors.value;
}

function updateErrorProbability() {
  DebugSettings.errorProbability = errorProbability.value;
}

function connectMockDevice() {
  emit('connect-mock-device');
}

function generateTestRom() {
  // 生成2MB的测试ROM数据
  const romSize = 0x200000; // 2MB
  const romData = new Uint8Array(romSize);

  // 首先生成随机数据作为基础
  const randomData = DebugSettings.generateRandomData(romSize);
  romData.set(randomData);

  // 创建GBA ROM标准头部
  const encoder = new TextEncoder();

  // 0x00-0x03: ARM7 入口点 (ARM opcode)
  romData[0x00] = 0x00; // b #0x08000000 - 跳转到真正的入口点
  romData[0x01] = 0x00;
  romData[0x02] = 0x00;
  romData[0x03] = 0xEA;

  // 0x04-0x9F: Nintendo Logo (156字节) - 必需的任天堂LOGO
  romData.set(GBA_NINTENDO_LOGO, 0x04);

  // 0xA0-0xAB: 游戏标题 (12字节)
  const title = 'TEST ROM    '; // 12字符，不足的用空格填充
  const titleBytes = encoder.encode(title.substring(0, 12));
  romData.set(titleBytes, 0xA0);

  // 0xAC-0xAF: 游戏代码 (4字节)
  const gameCode = 'TESJ'; // 4字符
  const gameCodeBytes = encoder.encode(gameCode);
  romData.set(gameCodeBytes, 0xAC);

  // 0xB0-0xB1: 制造商代码 (2字节)
  const makerCode = '01'; // 01 = Nintendo
  const makerCodeBytes = encoder.encode(makerCode);
  romData.set(makerCodeBytes, 0xB0);

  // 0xB2: 固定值 (必须是0x96)
  romData[0xB2] = 0x96;

  // 0xB3: 主单元代码 (通常是0x00)
  romData[0xB3] = 0x00;

  // 0xB4: 设备类型 (通常是0x00)
  romData[0xB4] = 0x00;

  // 0xB5-0xBB: 保留区域 (7字节，通常是0x00)
  for (let i = 0xB5; i <= 0xBB; i++) {
    romData[i] = 0x00;
  }

  // 0xBC: 软件版本
  romData[0xBC] = 0x01;

  // 0xBD: 头部校验和 (计算0xA0-0xBC的补码校验和)
  let headerSum = 0;
  for (let i = 0xA0; i <= 0xBC; i++) {
    headerSum += romData[i];
  }
  romData[0xBD] = (-(headerSum + 0x19)) & 0xFF;

  // 0xBE-0xBF: 保留区域 (通常是0x00)
  romData[0xBE] = 0x00;
  romData[0xBF] = 0x00;

  // 创建下载
  const blob = new Blob([romData], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'test_rom.gba';
  a.click();
  URL.revokeObjectURL(url);
}

function generateTestRam() {
  // 生成32KB的测试RAM数据
  const testData = DebugSettings.generateRandomData(0x8000);
  const blob = new Blob([testData as BlobPart], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'test_ram.sav';
  a.click();
  URL.revokeObjectURL(url);
}

function clearMockData() {
  console.log('[DEBUG] 清除模拟数据');

  // 发出清除事件到父组件
  emit('clear-mock-data');
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
  /* content: ''; */
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
</style>
