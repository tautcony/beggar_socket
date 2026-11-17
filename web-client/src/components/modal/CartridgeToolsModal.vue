<template>
  <RetroModal
    v-model="localVisible"
    :title="$t('ui.tools.title')"
    width="900px"
    max-height="90vh"
    padding="0"
    @close="closeModal"
  >
    <div class="tool-operations-container">
      <!-- Tab 标签 -->
      <div class="tabs-header">
        <RetroSegmented
          :model-value="activeTab"
          :options="[
            { value: 'rtc', label: $t('ui.tools.rtc.title') },
            { value: 'test', label: $t('ui.tools.test.title') },
          ]"
          @update:model-value="activeTab = $event as 'rtc' | 'test'"
        />
      </div>

      <!-- Tab 内容 -->
      <div class="tabs-content">
        <!-- RTC Tab -->
        <div
          v-show="activeTab === 'rtc'"
          class="tab-panel"
        >
          <div class="panel-layout">
            <div class="panel-left">
              <div class="button-group">
                <RetroButton
                  variant="secondary"
                  block
                  :disabled="!device || busy"
                  :text="$t('ui.tools.rtc.readGBA')"
                  @click="() => handleReadRTC('GBA')"
                />
                <RetroButton
                  variant="secondary"
                  block
                  :disabled="!device || busy"
                  :text="$t('ui.tools.rtc.setGBA')"
                  @click="() => handleSetRTC('GBA')"
                />
                <RetroButton
                  variant="secondary"
                  block
                  :disabled="!device || busy"
                  :text="$t('ui.tools.rtc.readMBC3')"
                  @click="() => handleReadRTC('MBC3')"
                />
                <RetroButton
                  variant="secondary"
                  block
                  :disabled="!device || busy"
                  :text="$t('ui.tools.rtc.setMBC3')"
                  @click="() => handleSetRTC('MBC3')"
                />
              </div>
            </div>
            <div class="panel-right">
              <div
                v-if="rtcTimeBase"
                class="digital-clock"
              >
                <div class="clock-time">
                  {{ currentTime }}
                </div>
                <div class="clock-date">
                  {{ currentDate }}
                </div>
              </div>
              <div
                v-else
                class="digital-clock-placeholder"
              >
                <div class="placeholder-text">
                  {{ $t('ui.tools.rtc.clockPlaceholder') }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Test Tab -->
        <div
          v-show="activeTab === 'test'"
          class="tab-panel"
        >
          <div class="panel-layout">
            <div class="panel-left">
              <div class="button-group">
                <RetroButton
                  variant="secondary"
                  block
                  :disabled="!device || busy"
                  :text="$t('ui.tools.test.rumble')"
                  @click="handleRumbleTest"
                />
                <RetroButton
                  variant="secondary"
                  block
                  :disabled="!device || busy"
                  :text="$t('ui.tools.test.ppbUnlockGBA')"
                  @click="handlePPBUnlockGBA"
                />
                <RetroButton
                  variant="secondary"
                  block
                  :disabled="!device || busy"
                  :text="$t('ui.tools.test.ppbUnlockMBC5')"
                  @click="handlePPBUnlockMBC5"
                />
              </div>
            </div>
            <div class="panel-right">
              <div class="log-container">
                <div
                  ref="logContentRef"
                  class="log-content"
                >
                  <div
                    v-for="(log, index) in logs"
                    :key="index"
                    class="log-entry"
                    :class="log.level"
                  >
                    <span class="log-time">{{ log.time }}</span>
                    <span class="log-message">{{ log.message }}</span>
                  </div>
                  <div
                    v-if="logs.length === 0"
                    class="log-empty"
                  >
                    {{ $t('ui.tools.test.noLogs') }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </RetroModal>

  <!-- RTC设置模态框 -->
  <RTCModal
    v-model:is-visible="isRTCModalVisible"
    :type="rtcType"
    @close="closeRTCModal"
    @confirm="handleRTCConfirm"
  />
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import RTCModal from '@/components/modal/RTCModal.vue';
import { RetroButton, RetroModal, RetroSegmented } from '@/components/retro';
import { useToast } from '@/composables/useToast';
import type { GBARTCData, MBC3RTCData } from '@/services/rtc';
import { ppbUnlockGBA, ppbUnlockMBC5, readRTC, rumbleTest, setRTC } from '@/services/tool-functions';
import type { DeviceInfo } from '@/types/device-info';

interface Props {
  isVisible: boolean;
  device?: DeviceInfo | null;
}

const props = withDefaults(defineProps<Props>(), {
  device: null,
});

const emit = defineEmits<{
  'close': [];
}>();

const { t } = useI18n();
const { showToast } = useToast();

const localVisible = computed({
  get: () => props.isVisible,
  set: (value: boolean) => {
    if (!value) {
      emit('close');
    }
  },
});

const busy = ref(false);
const isRTCModalVisible = ref(false);
const rtcType = ref<'GBA' | 'MBC3'>('GBA');
const activeTab = ref<'rtc' | 'test'>('rtc');

// 数字时钟
const currentTime = ref('');
const currentDate = ref('');
const rtcTimeBase = ref<DateTime | null>(null); // RTC 读取的基准时间
const rtcReadTime = ref<DateTime | null>(null); // RTC 读取时的系统时间
let clockInterval: NodeJS.Timeout | null = null;

// 日志
interface LogEntry {
  time: string;
  message: string;
  level: 'info' | 'success' | 'error' | 'warning';
}

const logs = ref<LogEntry[]>([]);
const logContentRef = ref<HTMLElement | null>(null);

function addLog(message: string, level: LogEntry['level'] = 'info') {
  const now = DateTime.now();
  logs.value.push({
    time: now.toFormat('HH:mm:ss'),
    message,
    level,
  });

  // 自动滚动到底部
  void nextTick(() => {
    if (logContentRef.value) {
      logContentRef.value.scrollTop = logContentRef.value.scrollHeight;
    }
  });
}

function updateClock() {
  if (rtcTimeBase.value && rtcReadTime.value) {
    // 计算从读取 RTC 到现在经过的时间
    const elapsed = DateTime.now().diff(rtcReadTime.value);
    // 基准时间加上经过的时间
    const displayTime = rtcTimeBase.value.plus(elapsed);
    currentTime.value = displayTime.toFormat('HH:mm:ss');
    currentDate.value = displayTime.toFormat('yyyy-MM-dd EEEE');
  }
}

function startClock(baseTime: DateTime) {
  // 设置基准时间和读取时间
  rtcTimeBase.value = baseTime;
  rtcReadTime.value = DateTime.now();

  // 立即更新一次
  updateClock();

  // 清除旧的定时器（如果存在）
  if (clockInterval) {
    clearInterval(clockInterval);
  }

  // 开始定时更新
  clockInterval = setInterval(updateClock, 1000);
}

onMounted(() => {
  // 不再自动启动时钟
});

onUnmounted(() => {
  if (clockInterval) {
    clearInterval(clockInterval);
  }
});

function closeModal() {
  emit('close');
}

// 计算时间差异的辅助函数
function calculateTimeDifference(rtcTime: DateTime): string {
  const rawDiff = DateTime.now().diff(rtcTime);
  const diff = rawDiff.mapUnits(Math.abs);
  const { days, hours, minutes, seconds } = diff.shiftTo('days', 'hours', 'minutes', 'seconds');

  // 过滤有效单位，最小0.1秒
  const units = [
    [days, t('ui.tools.rtc.timeDiff.units.day')],
    [hours, t('ui.tools.rtc.timeDiff.units.hour')],
    [minutes, t('ui.tools.rtc.timeDiff.units.minute')],
    [seconds >= 0.1 ? seconds : 0, t('ui.tools.rtc.timeDiff.units.second')],
  ].filter(([value]) => (value as number) > 0).slice(0, 2);

  if (units.length === 0) return '';

  const speedText = rawDiff.as('milliseconds') >= 0
    ? t('ui.tools.rtc.timeDiff.slow')
    : t('ui.tools.rtc.timeDiff.fast');

  const parts = units.map(([value, unit]) => {
    const numValue = value as number;
    const formattedValue = numValue === seconds
      ? (Math.round(numValue * 10) / 10).toFixed(1)
      : Math.floor(numValue).toString();
    return formattedValue + String(unit);
  });

  return `${speedText} ${parts.join(' ')}`;
}

function handleSetRTC(type: 'GBA' | 'MBC3') {
  rtcType.value = type;
  isRTCModalVisible.value = true;
}

async function handleReadRTC(type: 'GBA' | 'MBC3') {
  if (!props.device) {
    showToast(t('messages.device.notConnected'), 'error');
    return;
  }

  busy.value = true;
  try {
    const result = await readRTC(props.device, type);
    if (result.status && result.time) {
      // 启动时钟显示，以读取的时间为基准
      startClock(result.time);

      const timeDiff = calculateTimeDifference(result.time);
      const timeText = timeDiff
        ? `${result.time.toFormat('yyyy-MM-dd HH:mm:ss')} (${timeDiff})`
        : result.time.toFormat('yyyy-MM-dd HH:mm:ss');
      showToast(
        t('messages.tools.rtc.readSuccess', {
          time: timeText,
        }),
        'success',
      );
    } else {
      showToast(
        t('messages.tools.rtc.readFailed', {
          error: result.error ?? '未知错误',
        }),
        'error',
      );
    }
  } catch (error) {
    console.error(`读取${type} RTC失败:`, error);
    showToast(
      t('messages.tools.rtc.readFailed', {
        error: error instanceof Error ? error.message : String(error),
      }),
      'error',
    );
  } finally {
    busy.value = false;
  }
}

function closeRTCModal() {
  isRTCModalVisible.value = false;
}

async function handleRTCConfirm(data: GBARTCData | MBC3RTCData) {
  if (!props.device) {
    showToast(t('messages.device.notConnected'), 'error');
    return;
  }

  busy.value = true;
  closeRTCModal();

  try {
    if (rtcType.value === 'GBA') {
      await setRTC(props.device, 'GBA', data);
      showToast(t('messages.tools.rtc.gbaSuccess'), 'success');
    } else {
      await setRTC(props.device, 'MBC3', data);
      showToast(t('messages.tools.rtc.mbc3Success'), 'success');
    }
  } catch (error) {
    console.error('RTC setting failed:', error);
    showToast(
      t('messages.tools.rtc.failed', {
        error: error instanceof Error ? error.message : String(error),
      }),
      'error',
    );
  } finally {
    busy.value = false;
  }
}

async function handleRumbleTest() {
  if (!props.device) {
    showToast(t('messages.device.notConnected'), 'error');
    return;
  }

  busy.value = true;
  addLog(t('messages.tools.rumbleTest.start'), 'info');
  try {
    await rumbleTest(props.device);
    showToast(t('messages.tools.rumbleSuccess'), 'success');
    addLog(t('messages.tools.rumbleSuccess'), 'success');
  } catch (error) {
    console.error('Rumble test failed:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    showToast(
      t('messages.tools.rumbleFailed', {
        error: errorMsg,
      }),
      'error',
    );
    addLog(t('messages.tools.rumbleFailed', { error: errorMsg }), 'error');
  } finally {
    busy.value = false;
  }
}

async function handlePPBUnlockGBA() {
  if (!props.device) {
    showToast(t('messages.device.notConnected'), 'error');
    return;
  }

  busy.value = true;
  addLog(t('messages.tools.ppbUnlockGBA.start'), 'info');
  try {
    const result = await ppbUnlockGBA(props.device, ({ progress, message, type }) => {
      if (progress !== undefined) {
        addLog(`${t('messages.tools.ppbUnlockGBA.progress')}: ${progress}%`, 'info');
      } else if (message) {
        addLog(message, type === 'warn' ? 'warning' : type ?? 'info');
      }
    });

    if (result.success) {
      showToast(t('messages.tools.ppbUnlockGBASuccess'), 'success');
      addLog(t('messages.tools.ppbUnlockGBASuccess'), 'success');
    } else {
      showToast(
        t('messages.tools.ppbUnlockGBAFailed', {
          error: result.message,
        }),
        'error',
      );
      addLog(t('messages.tools.ppbUnlockGBAFailed', { error: result.message }), 'error');
    }
  } catch (error) {
    console.error('GBA PPB unlock failed:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    showToast(
      t('messages.tools.ppbUnlockGBAFailed', {
        error: errorMsg,
      }),
      'error',
    );
    addLog(t('messages.tools.ppbUnlockGBAFailed', { error: errorMsg }), 'error');
  } finally {
    busy.value = false;
  }
}

async function handlePPBUnlockMBC5() {
  if (!props.device) {
    showToast(t('messages.device.notConnected'), 'error');
    return;
  }

  busy.value = true;
  addLog(t('messages.tools.ppbUnlockMBC5.start'), 'info');
  try {
    const result = await ppbUnlockMBC5(props.device, ({ progress, message, type }) => {
      if (progress !== undefined) {
        addLog(`${t('messages.tools.ppbUnlockMBC5.progress')}: ${progress}%`, 'info');
      } else if (message) {
        addLog(message, type === 'warn' ? 'warning' : type ?? 'info');
      }
    });

    if (result.success) {
      showToast(t('messages.tools.ppbUnlockMBC5Success'), 'success');
      addLog(t('messages.tools.ppbUnlockMBC5Success'), 'success');
    } else {
      showToast(
        t('messages.tools.ppbUnlockMBC5Failed', {
          error: result.message,
        }),
        'error',
      );
      addLog(t('messages.tools.ppbUnlockMBC5Failed', { error: result.message }), 'error');
    }
  } catch (error) {
    console.error('MBC5 PPB unlock failed:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    showToast(
      t('messages.tools.ppbUnlockMBC5Failed', {
        error: errorMsg,
      }),
      'error',
    );
    addLog(t('messages.tools.ppbUnlockMBC5Failed', { error: errorMsg }), 'error');
  } finally {
    busy.value = false;
  }
}
</script>

<style lang="scss" scoped>
@use '@/styles/variables/spacing' as spacing-vars;
@use '@/styles/variables/typography' as typography-vars;
@use '@/styles/variables/radius' as radius-vars;
@use '@/styles/mixins' as mixins;

.tool-operations-container {
  padding: spacing-vars.$space-4;
}

// Tab 标签头部
.tabs-header {
  display: flex;
  margin-bottom: spacing-vars.$space-4;
}

// Tab 内容
.tabs-content {
  min-height: 300px;
}

.tab-panel {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

// 面板布局
.panel-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: spacing-vars.$space-4;
  align-items: start;
}

.panel-left {
  border: 1.5px solid var(--retro-border-subtle);
  border-radius: 6px;
  padding: spacing-vars.$space-3;
  background: var(--retro-bg-elevated);
}

.panel-right {
  border: 1.5px solid var(--retro-border-subtle);
  border-radius: 6px;
  background: var(--retro-bg-surface);
}

.button-group {
  @include mixins.flex-column;
  gap: spacing-vars.$space-2;
}

// 数字时钟样式
.digital-clock {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: spacing-vars.$space-4;

  .clock-time {
    font-size: 64px;
    font-weight: typography-vars.$font-weight-bold;
    font-family: var(--retro-font-mono);
    color: var(--retro-ink);
    margin-bottom: spacing-vars.$space-4;
    letter-spacing: 0.1em;
  }

  .clock-date {
    font-size: typography-vars.$font-size-lg;
    color: var(--color-text-secondary);
    font-family: var(--retro-font-mono);
  }
}

// 时钟占位符样式
.digital-clock-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: spacing-vars.$space-4;

  .placeholder-text {
    font-size: typography-vars.$font-size-base;
    color: var(--color-text-secondary);
    text-align: center;
    font-style: italic;
    opacity: 0.6;
  }
}

// 日志容器样式
.log-container {
  display: flex;
  flex-direction: column;
  height: 280px;
  overflow: hidden;
}

.log-header {
  padding: spacing-vars.$space-3 spacing-vars.$space-4;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  font-size: typography-vars.$font-size-sm;
  font-weight: typography-vars.$font-weight-medium;
  color: var(--color-text);
}

.log-content {
  flex: 1;
  overflow-y: auto;
  padding: spacing-vars.$space-3 spacing-vars.$space-4;
  font-family: var(--retro-font-mono);
  font-size: typography-vars.$font-size-xs;
  line-height: 1.6;
}

.log-entry {
  display: flex;
  gap: spacing-vars.$space-3;

  &.info {
    color: var(--color-text);
  }

  &.success {
    color: #10b981;
  }

  &.error {
    color: #ef4444;
  }

  &.warning {
    color: #f59e0b;
  }

  .log-time {
    color: var(--color-text-secondary);
    min-width: 70px;
    font-size: typography-vars.$font-size-xs;
  }

  .log-message {
    flex: 1;
    word-break: break-word;
  }
}

.log-empty {
  color: var(--color-text-secondary);
  text-align: center;
  padding: spacing-vars.$space-8;
  font-style: italic;
  opacity: 0.6;
}
</style>
