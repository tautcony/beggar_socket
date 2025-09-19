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
          <BaseButton
            variant="debug"
            size="sm"
            :text="$t('ui.debug.connectMockDevice')"
            @click="connectMockDevice"
          />
          <BaseButton
            variant="debug"
            size="sm"
            :text="$t('ui.debug.generateTestRom')"
            @click="generateTestRom"
          />
          <BaseButton
            variant="debug"
            size="sm"
            :text="$t('ui.debug.generateTestRam')"
            @click="generateTestRam"
          />
          <BaseButton
            variant="debug"
            size="sm"
            class="secondary"
            :text="$t('ui.debug.clearMockData')"
            @click="clearMockData"
          />
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

import BaseButton from '@/components/common/BaseButton.vue';
import { DebugSettings } from '@/settings/debug-settings';
import { GBA_NINTENDO_LOGO } from '@/utils/parsers/rom-parser';

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
  top: var(--space-5);
  left: var(--space-5);
  width: 320px;
  max-height: 80vh;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border: 2px solid var(--color-warning);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  z-index: 1000;
  color: var(--color-text);
  overflow: hidden;
  transition: all 0.3s ease;
}

.debug-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  background: linear-gradient(135deg, var(--color-warning), var(--color-warning-light));
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  position: relative;
}

.debug-header::before {
  /* content: ''; */
  position: absolute;
  left: calc(var(--space-2) * -1);
  top: 50%;
  transform: translateY(-50%);
  font-size: var(--font-size-xl);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.debug-header h3 {
  margin: 0;
  font-size: var(--font-size-base);
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.debug-content {
  padding: var(--space-4);
  max-height: 60vh;
  overflow-y: auto;
  background: rgba(248, 249, 250, 0.8);
}

.debug-section {
  margin-bottom: var(--space-5);
  padding-bottom: var(--space-3) var(--space-4) 0;
  border-bottom: 1px solid var(--color-border-light);
}

.debug-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.debug-section h4 {
  margin: 0 0 var(--space-2) 0;
  font-size: var(--font-size-sm);
  color: var(--color-text);
  font-weight: var(--font-weight-semibold);
}

.debug-switch {
  display: flex;
  align-items: center;
  cursor: pointer;
  margin-bottom: var(--space-2);
}

.debug-switch input {
  margin-right: var(--space-2);
}

.debug-control {
  margin-bottom: var(--space-3);
}

.debug-control label {
  display: block;
  margin-bottom: var(--space-1);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
}

.debug-control input[type="number"],
.debug-control input[type="range"] {
  width: 80%;
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-base);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: var(--font-size-xs);
  transition: border-color 0.2s ease;
}

.debug-control input[type="number"]:focus,
.debug-control input[type="range"]:focus {
  outline: none;
  border-color: var(--color-warning);
  box-shadow: 0 0 0 2px rgba(255, 152, 0, 0.1);
}

.debug-control input[type="range"] {
  padding: 0;
}

.debug-value {
  margin-left: var(--space-2);
  font-size: var(--font-size-xs);
  color: var(--color-warning);
  font-weight: var(--font-weight-semibold);
}

.debug-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

.debug-status {
  font-size: var(--font-size-xs);
  background: rgba(248, 249, 250, 0.5);
  padding: var(--space-2);
  border-radius: var(--radius-base);
  border: 1px solid var(--color-border-light);
}

.status-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--space-1);
  padding: var(--space-px) 0;
}

.status-label {
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
}

.status-value {
  color: var(--color-text);
  font-weight: var(--font-weight-semibold);
}

.status-value.active {
  color: var(--color-success);
}

.status-value.inactive {
  color: var(--color-text-secondary);
}
</style>
