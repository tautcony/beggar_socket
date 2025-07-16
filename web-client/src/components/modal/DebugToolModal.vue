<template>
  <BaseModal
    v-model="localVisible"
    :title="$t('ui.debug.tool.title')"
    width="1200px"
    max-width="95vw"
    @close="$emit('close')"
  >
    <div class="debug-tool">
      <div class="debug-form">
        <div class="form-row">
          <div class="form-group">
            <label>{{ $t('ui.debug.tool.commandType') }}</label>
            <select
              v-model="selectedCommandType"
              @change="onCommandTypeChange"
            >
              <option value="">
                {{ $t('ui.debug.tool.selectCommandType') }}
              </option>
              <option value="GBA">
                GBA
              </option>
              <option value="GBC">
                GBC (MBC5)
              </option>
            </select>
          </div>

          <div
            v-if="selectedCommandType"
            class="form-group"
          >
            <label>{{ $t('ui.debug.tool.command') }}</label>
            <select
              v-model="selectedCommand"
              @change="onCommandChange"
            >
              <option value="">
                {{ $t('ui.debug.tool.selectCommand') }}
              </option>
              <option
                v-for="(value, key) in availableCommands"
                :key="key"
                :value="value"
              >
                {{ getCommandDisplayName(key, value) }}
              </option>
            </select>
          </div>
        </div>

        <div
          v-if="selectedCommand"
          class="form-row"
        >
          <div class="form-group">
            <label>{{ $t('ui.debug.tool.address') }} ({{ $t('ui.debug.tool.optional') }})</label>
            <input
              v-model="address"
              type="text"
              :placeholder="$t('ui.debug.tool.addressPlaceholder')"
            >
          </div>

          <div class="form-group">
            <label>{{ $t('ui.debug.tool.length') }} ({{ $t('ui.debug.tool.optional') }})</label>
            <input
              v-model="length"
              type="number"
              min="1"
              :placeholder="$t('ui.debug.tool.lengthPlaceholder')"
            >
          </div>
        </div>

        <div
          v-if="selectedCommand"
          class="form-row"
        >
          <div class="form-group">
            <label>{{ $t('ui.debug.tool.receiveLength') }}</label>
            <input
              v-model="receiveLength"
              type="number"
              min="1"
              max="8192"
              :placeholder="$t('ui.debug.tool.receiveLengthPlaceholder')"
            >
            <small class="form-hint">{{ $t('ui.debug.tool.receiveLengthHint') }}</small>
          </div>

          <div class="form-group">
            <label>{{ $t('ui.debug.tool.timeout') }} ({{ $t('ui.debug.tool.optional') }})</label>
            <input
              v-model="timeout"
              type="number"
              min="100"
              :placeholder="$t('ui.debug.tool.timeoutPlaceholder')"
            >
            <small class="form-hint">{{ $t('ui.debug.tool.timeoutHint') }}</small>
          </div>
        </div>

        <div
          v-if="selectedCommand"
          class="form-group"
        >
          <label>{{ $t('ui.debug.tool.data') }} ({{ $t('ui.debug.tool.optional') }})</label>
          <textarea
            v-model="data"
            :placeholder="$t('ui.debug.tool.dataPlaceholder')"
            rows="4"
          />
          <small class="form-hint">{{ $t('ui.debug.tool.dataHint') }}</small>
        </div>

        <div class="form-actions">
          <button
            class="btn btn-primary"
            :disabled="!canSend || isSending"
            @click="sendCommand"
          >
            <IonIcon
              v-if="isSending"
              :icon="hourglassOutline"
              class="spinning"
            />
            <IonIcon
              v-else
              :icon="sendOutline"
            />
            {{ isSending ? $t('ui.debug.tool.sending') : $t('ui.debug.tool.send') }}
          </button>

          <button
            class="btn btn-secondary"
            @click="clearForm"
          >
            <IonIcon :icon="refreshOutline" />
            {{ $t('ui.debug.tool.clear') }}
          </button>
        </div>
      </div>

      <div class="debug-output">
        <div class="output-section">
          <h4>{{ $t('ui.debug.tool.request') }}</h4>
          <div class="data-display">
            <div
              v-if="requestData"
              class="data-hex"
            >
              {{ formatHexData(requestData) }}
            </div>
            <div
              v-else
              class="data-placeholder"
            >
              {{ $t('ui.debug.tool.noRequestData') }}
            </div>
          </div>
        </div>

        <div class="output-section">
          <h4>{{ $t('ui.debug.tool.response') }}</h4>
          <div class="data-display">
            <div
              v-if="responseData"
              class="data-hex"
            >
              {{ formatHexData(responseData) }}
            </div>
            <div
              v-else-if="errorMessage"
              class="data-error"
            >
              <IonIcon :icon="alertCircleOutline" />
              {{ errorMessage }}
            </div>
            <div
              v-else
              class="data-placeholder"
            >
              {{ $t('ui.debug.tool.noResponseData') }}
            </div>
          </div>
        </div>

        <div
          v-if="responseData"
          class="output-section"
        >
          <h4>{{ $t('ui.debug.tool.analysis') }}</h4>
          <div class="analysis-display">
            <div class="analysis-item">
              <span class="label">{{ $t('ui.debug.tool.responseLength') }}:</span>
              <span class="value">{{ responseData.length }} {{ $t('ui.debug.tool.bytes') }}</span>
            </div>
            <div class="analysis-item">
              <span class="label">{{ $t('ui.debug.tool.executionTime') }}:</span>
              <span class="value">{{ executionTime }}ms</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import {
  alertCircleOutline,
  hourglassOutline,
  refreshOutline,
  sendOutline,
} from 'ionicons/icons';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseModal from '@/components/common/BaseModal.vue';
import { useToast } from '@/composables/useToast';
import { GBACommand, GBCCommand } from '@/protocol/beggar_socket/command';
import { createCommandPayload } from '@/protocol/beggar_socket/payload-builder';
import { getPackage, sendPackage } from '@/protocol/beggar_socket/protocol-utils';
import type { DeviceInfo } from '@/types/device-info';
import { formatHex } from '@/utils/formatter-utils';

const props = defineProps<{
  modelValue: boolean;
  device?: DeviceInfo | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
}>();

const { t } = useI18n();
const { showToast } = useToast();

// 创建一个计算属性来处理 v-model
const localVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => {
    emit('update:modelValue', value);
  },
});

const selectedCommandType = ref<'GBA' | 'GBC' | ''>('');
const selectedCommand = ref<number | ''>('');
const address = ref('');
const length = ref<number | ''>('');
const data = ref('');
const receiveLength = ref<number | ''>('');
const timeout = ref<number | ''>('');

const requestData = ref<Uint8Array | null>(null);
const responseData = ref<Uint8Array | null>(null);
const errorMessage = ref('');
const executionTime = ref(0);
const isSending = ref(false);

const availableCommands = computed(() => {
  const commands: Record<string, number> = {};

  if (selectedCommandType.value === 'GBA') {
    // 只获取枚举的字符串键
    Object.keys(GBACommand).forEach(key => {
      if (isNaN(Number(key))) {
        commands[key] = GBACommand[key as keyof typeof GBACommand] as number;
      }
    });
  } else if (selectedCommandType.value === 'GBC') {
    // 只获取枚举的字符串键
    Object.keys(GBCCommand).forEach(key => {
      if (isNaN(Number(key))) {
        commands[key] = GBCCommand[key as keyof typeof GBCCommand] as number;
      }
    });
  }

  return commands;
});

const canSend = computed(() => {
  return selectedCommandType.value && selectedCommand.value !== '' && receiveLength.value !== '';
});

// 根据命令设置默认接收长度
function setDefaultReceiveLength(command: number, commandType: 'GBA' | 'GBC') {
  if (commandType === 'GBA') {
    switch (command) {
      case 0xf0: // READ_ID
        receiveLength.value = 10; // 2 bytes CRC + 8 bytes ID
        break;
      case 0xf1: // ERASE_CHIP
      case 0xf2: // BLOCK_ERASE
      case 0xf3: // SECTOR_ERASE
      case 0xf4: // PROGRAM
      case 0xf5: // DIRECT_WRITE
      case 0xf7: // RAM_WRITE
      case 0xf9: // RAM_WRITE_TO_FLASH
        receiveLength.value = 1; // 1 byte result (0xaa or other)
        break;
      case 0xf6: // READ
      case 0xf8: // RAM_READ
        // 对于读取命令，默认长度取决于用户输入的length + 2 bytes CRC
        // 如果没有输入length，则设置一个合理的默认值
        const defaultReadLength = length.value ? Number(length.value) + 2 : 258; // 256 bytes + 2 CRC
        receiveLength.value = defaultReadLength;
        break;
      default:
        receiveLength.value = 64; // 默认64字节
    }
  } else if (commandType === 'GBC') {
    switch (command) {
      case 0xfa: // DIRECT_WRITE
      case 0xfc: // ROM_PROGRAM
        receiveLength.value = 1; // 1 byte result (0xaa or other)
        break;
      case 0xfb: // READ
        // 对于读取命令，默认长度取决于用户输入的length + 2 bytes CRC
        const defaultReadLength = length.value ? Number(length.value) + 2 : 258; // 256 bytes + 2 CRC
        receiveLength.value = defaultReadLength;
        break;
      default:
        receiveLength.value = 64; // 默认64字节
    }
  }
}

function onCommandTypeChange() {
  selectedCommand.value = '';
  receiveLength.value = '';
  clearOutput();
}

function onCommandChange() {
  if (typeof selectedCommand.value === 'number' && selectedCommandType.value) {
    setDefaultReceiveLength(selectedCommand.value, selectedCommandType.value);
  }
}

function clearForm() {
  selectedCommandType.value = '';
  selectedCommand.value = '';
  address.value = '';
  length.value = '';
  data.value = '';
  receiveLength.value = '';
  timeout.value = '';
  clearOutput();
}

function clearOutput() {
  requestData.value = null;
  responseData.value = null;
  errorMessage.value = '';
  executionTime.value = 0;
}

function getCommandDisplayName(key: string, value: number): string {
  const hexValue = '0x' + value.toString(16).toUpperCase().padStart(2, '0');

  // 检查是否存在重复的命令名称
  const gbaKeys = Object.keys(GBACommand).filter(k => isNaN(Number(k)));
  const gbcKeys = Object.keys(GBCCommand).filter(k => isNaN(Number(k)));
  const allKeys = [...gbaKeys, ...gbcKeys];
  const duplicateCount = allKeys.filter(k => k === key).length;

  // 如果有重复，添加类型前缀进行区分
  if (duplicateCount > 1) {
    return `${selectedCommandType.value}_${key} (${hexValue})`;
  }

  return `${key} (${hexValue})`;
}

function parseHexString(hexStr: string): Uint8Array {
  const cleaned = hexStr.replace(/[^0-9a-fA-F]/g, '');
  if (cleaned.length % 2 !== 0) {
    throw new Error(t('ui.debug.tool.errors.invalidHexLength'));
  }

  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < cleaned.length; i += 2) {
    bytes[i / 2] = parseInt(cleaned.slice(i, i + 2), 16);
  }
  return bytes;
}

function parseAddress(addrStr: string): number | null {
  if (!addrStr.trim()) return null;

  const cleaned = addrStr.trim();
  if (cleaned.startsWith('0x') || cleaned.startsWith('0X')) {
    return parseInt(cleaned, 16);
  } else if (/^[0-9a-fA-F]+$/.test(cleaned)) {
    return parseInt(cleaned, 16);
  } else {
    return parseInt(cleaned, 10);
  }
}

async function sendCommand() {
  if (!canSend.value) return;

  // 获取当前连接的设备
  const device = props.device;
  if (!device) {
    showToast(t('ui.debug.tool.errors.noDevice'), 'error');
    return;
  }

  isSending.value = true;
  clearOutput();

  try {
    const startTime = performance.now();

    // 构建命令载荷
    const payloadBuilder = createCommandPayload(selectedCommand.value as number);

    // 添加地址（如果有）
    const parsedAddress = parseAddress(address.value);
    if (parsedAddress !== null) {
      payloadBuilder.addAddress(parsedAddress);
    }

    // 添加长度（如果有）
    if (length.value !== '') {
      payloadBuilder.addLittleEndian(Number(length.value), 4);
    }

    // 添加数据（如果有）
    if (data.value.trim()) {
      try {
        const dataBytes = parseHexString(data.value);
        payloadBuilder.addBytes(dataBytes);
      } catch (error) {
        throw new Error(t('ui.debug.tool.errors.invalidHexData'));
      }
    }

    const payload = payloadBuilder.build();
    requestData.value = payload;

    // 发送命令
    await sendPackage(device.writer, payload);

    // 接收响应 - 使用用户设置的接收长度
    const maxResponseLength = receiveLength.value ? Number(receiveLength.value) : 4096;
    const timeoutMs = timeout.value ? Number(timeout.value) : undefined;
    const result = await getPackage(device.reader, maxResponseLength, timeoutMs);

    if (result.data) {
      responseData.value = result.data;
    } else {
      throw new Error(t('ui.debug.tool.errors.noResponse'));
    }

    const endTime = performance.now();
    executionTime.value = Math.round(endTime - startTime);

    showToast(t('ui.debug.tool.commandSent'), 'success');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
    showToast(t('ui.debug.tool.errors.commandFailed'), 'error');
  } finally {
    isSending.value = false;
  }
}

function formatHexData(hexData: Uint8Array): string {
  const hexString = Array.from(hexData)
    .map(byte => byte.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ');

  // 每16字节换行
  const lines = [];
  for (let i = 0; i < hexString.length; i += 48) { // 16 * 3 - 1 = 47 + 1 = 48
    lines.push(hexString.slice(i, i + 47));
  }
  return lines.join('\n');
}
</script>

<style scoped>
.debug-tool {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  min-height: 400px;
}

.debug-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-weight: 600;
  color: #2c3e50;
  font-size: 0.9rem;
}

.form-group select,
.form-group input,
.form-group textarea {
  padding: 10px 12px;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  font-size: 0.9rem;
  font-family: 'Fira Code', 'Monaco', monospace;
}

.form-group select:focus,
.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.form-hint {
  color: #6c757d;
  font-size: 0.8rem;
  margin-top: 4px;
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: auto;
}

.btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.9rem;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #545b62;
}

.debug-output {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.output-section {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  overflow: hidden;
}

.output-section h4 {
  margin: 0;
  padding: 12px 16px;
  background: #e9ecef;
  border-bottom: 1px solid #dee2e6;
  font-size: 0.9rem;
  font-weight: 600;
  color: #495057;
}

.data-display {
  padding: 16px;
  min-height: 100px;
  max-height: 200px;
  overflow-y: auto;
}

.data-hex {
  font-family: 'Fira Code', 'Monaco', monospace;
  font-size: 0.85rem;
  line-height: 1.4;
  white-space: pre;
  color: #2c3e50;
  background: white;
  padding: 12px;
  border-radius: 4px;
  border: 1px solid #e9ecef;
}

.data-placeholder {
  color: #6c757d;
  font-style: italic;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 68px;
}

.data-error {
  color: #dc3545;
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f8d7da;
  padding: 12px;
  border-radius: 4px;
  border: 1px solid #f5c6cb;
}

.analysis-display {
  padding: 16px;
}

.analysis-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #e9ecef;
}

.analysis-item:last-child {
  border-bottom: none;
}

.analysis-item .label {
  font-weight: 500;
  color: #495057;
}

.analysis-item .value {
  font-family: 'Fira Code', 'Monaco', monospace;
  color: #2c3e50;
  font-weight: 600;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 1024px) {
  .debug-tool {
    grid-template-columns: 1fr;
  }

  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
