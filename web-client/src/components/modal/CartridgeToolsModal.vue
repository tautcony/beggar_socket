<template>
  <BaseModal
    v-model="localVisible"
    :title="$t('ui.tools.title')"
    width="800px"
    max-height="90vh"
    @close="closeModal"
  >
    <div class="tool-operations-container">
      <div class="tool-content">
        <div class="tool-grid">
          <div class="tool-category">
            <h3>{{ $t('ui.tools.rtc.title') }}</h3>
            <div class="button-group">
              <button
                :disabled="!device || busy"
                @click="() => handleReadRTC('GBA')"
              >
                {{ $t('ui.tools.rtc.readGBA') }}
              </button>
              <button
                :disabled="!device || busy"
                @click="() => handleSetRTC('GBA')"
              >
                {{ $t('ui.tools.rtc.setGBA') }}
              </button>
              <button
                :disabled="!device || busy"
                @click="() => handleReadRTC('MBC3')"
              >
                {{ $t('ui.tools.rtc.readMBC3') }}
              </button>
              <button
                :disabled="!device || busy"
                @click="() => handleSetRTC('MBC3')"
              >
                {{ $t('ui.tools.rtc.setMBC3') }}
              </button>
            </div>
          </div>

          <div class="tool-category">
            <h3>{{ $t('ui.tools.test.title') }}</h3>
            <div class="button-group">
              <button
                :disabled="!device || busy"
                @click="handleRumbleTest"
              >
                {{ $t('ui.tools.test.rumble') }}
              </button>
              <button
                :disabled="!device || busy"
                @click="handlePPBUnlockGBA"
              >
                {{ $t('ui.tools.test.ppbUnlockGBA') }}
              </button>
              <button
                :disabled="!device || busy"
                @click="handlePPBUnlockMBC5"
              >
                {{ $t('ui.tools.test.ppbUnlockMBC5') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </BaseModal>

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
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseModal from '@/components/common/BaseModal.vue';
import RTCModal from '@/components/modal/RTCModal.vue';
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
      await setRTC(props.device, 'GBA', data as GBARTCData);
      showToast(t('messages.tools.rtc.gbaSuccess'), 'success');
    } else {
      await setRTC(props.device, 'MBC3', data as MBC3RTCData);
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
  try {
    await rumbleTest(props.device);
    showToast(t('messages.tools.rumbleSuccess'), 'success');
  } catch (error) {
    console.error('Rumble test failed:', error);
    showToast(
      t('messages.tools.rumbleFailed', {
        error: error instanceof Error ? error.message : String(error),
      }),
      'error',
    );
  } finally {
    busy.value = false;
  }
}

async function handlePPBUnlockGBA() {
  if (!props.device) {
    showToast(t('messages.device.notConnected'), 'error');
    return;
  }

  // 获取用户输入的扇区数量
  const sectorCountInput = prompt(t('ui.tools.ppb.sectorCountPrompt', { max: 512 }), '16');
  if (sectorCountInput === null) {
    return; // 用户取消了输入
  }

  const sectorCount = parseInt(sectorCountInput, 10);
  if (isNaN(sectorCount) || sectorCount <= 0 || sectorCount > 512) {
    showToast(t('ui.tools.ppb.sectorCountError', { min: 1, max: 512 }), 'error');
    return;
  }

  busy.value = true;
  try {
    const result = await ppbUnlockGBA(props.device, sectorCount, (progress) => {
      // 可以在这里更新进度显示
      console.log(`PPB解锁进度: ${progress}%`);
    });

    if (result.success) {
      showToast(t('messages.tools.ppbUnlockGBASuccess'), 'success');
    } else {
      showToast(
        t('messages.tools.ppbUnlockGBAFailed', {
          error: result.message,
        }),
        'error',
      );
    }
  } catch (error) {
    console.error('GBA PPB unlock failed:', error);
    showToast(
      t('messages.tools.ppbUnlockGBAFailed', {
        error: error instanceof Error ? error.message : String(error),
      }),
      'error',
    );
  } finally {
    busy.value = false;
  }
}

async function handlePPBUnlockMBC5() {
  if (!props.device) {
    showToast(t('messages.device.notConnected'), 'error');
    return;
  }

  // 获取用户输入的扇区数量
  const sectorCountInput = prompt(t('ui.tools.ppb.sectorCountPrompt', { max: 256 }), '16');
  if (sectorCountInput === null) {
    return; // 用户取消了输入
  }

  const sectorCount = parseInt(sectorCountInput, 10);
  if (isNaN(sectorCount) || sectorCount <= 0 || sectorCount > 256) {
    showToast(t('ui.tools.ppb.sectorCountError', { min: 1, max: 256 }), 'error');
    return;
  }

  busy.value = true;
  try {
    const result = await ppbUnlockMBC5(props.device, sectorCount, (progress: number) => {
      // 可以在这里更新进度显示
      console.log(`PPB解锁进度: ${progress}%`);
    });

    if (result.success) {
      showToast(t('messages.tools.ppbUnlockMBC5Success'), 'success');
    } else {
      showToast(
        t('messages.tools.ppbUnlockMBC5Failed', {
          error: result.message,
        }),
        'error',
      );
    }
  } catch (error) {
    console.error('MBC5 PPB unlock failed:', error);
    showToast(
      t('messages.tools.ppbUnlockMBC5Failed', {
        error: error instanceof Error ? error.message : String(error),
      }),
      'error',
    );
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.tool-operations-container {
  margin-bottom: var(--space-4);
}

.tool-content {
  padding: 0;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-6);
}

.tool-category {
  border: var(--border-width) var(--border-style) var(--color-border-light);
  border-radius: var(--radius-base);
  padding: var(--space-4);
  background: var(--color-bg-secondary);
}

.tool-category h3 {
  margin: 0 0 var(--space-3) 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.button-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.button-group button {
  padding: var(--space-2) var(--space-4);
  border: var(--border-width) var(--border-style) var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: var(--font-size-sm);
}

.button-group button:hover:not(:disabled) {
  background: var(--color-bg-secondary);
  border-color: var(--color-border-light);
}

.button-group button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.button-group button:active:not(:disabled) {
  transform: translateY(1px);
}
</style>
