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
                @click="handleReadGBARTC"
              >
                {{ $t('ui.tools.rtc.readGBA') }}
              </button>
              <button
                :disabled="!device || busy"
                @click="handleSetGBARTC"
              >
                {{ $t('ui.tools.rtc.setGBA') }}
              </button>
              <button
                :disabled="!device || busy"
                @click="handleReadMBC3RTC"
              >
                {{ $t('ui.tools.rtc.readMBC3') }}
              </button>
              <button
                :disabled="!device || busy"
                @click="handleSetMBC3RTC"
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
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseModal from '@/components/common/BaseModal.vue';
import RTCModal from '@/components/modal/RTCModal.vue';
import { useToast } from '@/composables/useToast';
import { type GBARTCData, type MBC3RTCData, ppbUnlockGBA, ppbUnlockMBC5, readGBARTC, readMBC3RTC, rumbleTest, setGBARTC, setMBC3RTC } from '@/services/tool-functions';
import type { DeviceInfo } from '@/types/device-info';

interface Props {
  isVisible: boolean;
  device?: DeviceInfo | null;
  mode?: 'GBA' | 'MBC5';
}

const props = withDefaults(defineProps<Props>(), {
  device: null,
  mode: 'GBA',
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

function handleSetGBARTC() {
  rtcType.value = 'GBA';
  isRTCModalVisible.value = true;
}

function handleSetMBC3RTC() {
  rtcType.value = 'MBC3';
  isRTCModalVisible.value = true;
}

async function handleReadGBARTC() {
  if (!props.device) {
    showToast(t('messages.device.notConnected'), 'error');
    return;
  }

  busy.value = true;
  try {
    const result = await readGBARTC(props.device);
    if (result.status && result.time) {
      showToast(
        t('messages.tools.rtc.readSuccess', {
          time: result.time.toLocaleString(),
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
    console.error('读取GBA RTC失败:', error);
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

async function handleReadMBC3RTC() {
  if (!props.device) {
    showToast(t('messages.device.notConnected'), 'error');
    return;
  }

  busy.value = true;
  try {
    const result = await readMBC3RTC(props.device);
    if (result.status && result.time) {
      showToast(
        t('messages.tools.rtc.readSuccess', {
          time: result.time.toLocaleString(),
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
    console.error('读取MBC3 RTC失败:', error);
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
      await setGBARTC(props.device, data as GBARTCData);
      showToast(t('messages.tools.rtc.gbaSuccess'), 'success');
    } else {
      await setMBC3RTC(props.device, data as MBC3RTCData);
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
  const sectorCountInput = prompt('请输入要检查的扇区数量 (1-512):', '16');
  if (sectorCountInput === null) {
    return; // 用户取消了输入
  }

  const sectorCount = parseInt(sectorCountInput, 10);
  if (isNaN(sectorCount) || sectorCount <= 0 || sectorCount > 512) {
    showToast('扇区数量必须是1-512之间的整数', 'error');
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
  const sectorCountInput = prompt('请输入要检查的扇区数量 (1-256):', '16');
  if (sectorCountInput === null) {
    return; // 用户取消了输入
  }

  const sectorCount = parseInt(sectorCountInput, 10);
  if (isNaN(sectorCount) || sectorCount <= 0 || sectorCount > 256) {
    showToast('扇区数量必须是1-256之间的整数', 'error');
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
  margin-bottom: 1rem;
}

.tool-content {
  padding: 0;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.tool-category {
  border: 1px solid #f3f4f6;
  border-radius: 6px;
  padding: 1rem;
  background: #f9fafb;
}

.tool-category h3 {
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
  font-weight: 500;
  color: #6b7280;
}

.button-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.button-group button {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: white;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.9rem;
}

.button-group button:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #9ca3af;
}

.button-group button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.button-group button:active:not(:disabled) {
  transform: translateY(1px);
}
</style>
