<template>
  <RetroModal
    v-model="localVisible"
    :title="$t('ui.debug.tool.title')"
    width="1200px"
    max-width="95vw"
    :mask-closable="false"
    @close="$emit('close')"
  >
    <template #header>
      <div class="debug-modal-header">
        <div class="debug-modal-header__left">
          <h3 class="retro-modal-title">
            {{ $t('ui.debug.tool.title') }}
          </h3>
          <RetroBadge
            :variant="hasDevice ? 'success' : 'warning'"
            :text="hasDevice ? $t('ui.debug.tool.deviceConnected') : $t('ui.debug.tool.deviceDisconnected')"
          />
          <span
            v-if="deviceLabel"
            class="device-label"
          >
            {{ deviceLabel }}
          </span>
        </div>
        <div class="debug-modal-header__right">
          <span class="shortcut-hint">{{ $t('ui.debug.tool.shortcutHint') }}</span>
          <RetroButton
            variant="ghost"
            icon-only
            icon="pixelarticons:close"
            @click="localVisible = false; $emit('close')"
          />
        </div>
      </div>
    </template>

    <div
      class="debug-tool-shell"
      @keydown="handleFormKeydown"
    >
      <div
        v-if="commandHistory.length > 0"
        class="history-bar"
      >
        <span class="history-bar__label">{{ $t('ui.debug.tool.history') }}:</span>
        <div class="history-bar__items">
          <button
            v-for="item in commandHistory"
            :key="item.id"
            type="button"
            class="history-chip"
            :title="item.summary"
            @click="applyHistoryItem(item)"
          >
            <span class="history-chip__cmd">{{ item.label }}</span>
            <span
              v-if="item.address"
              class="history-chip__addr"
            >
              @ {{ item.address }}
            </span>
          </button>
        </div>
        <button
          type="button"
          class="history-clear-btn"
          @click="commandHistory = []"
        >
          {{ $t('ui.debug.tool.clearHistory') }}
        </button>
      </div>

      <div class="debug-tool">
        <div class="debug-form">
          <div class="form-row">
            <div class="form-group">
              <label>{{ $t('ui.debug.tool.commandType') }}</label>
              <RetroSelect
                v-model="selectedCommandType"
                size="md"
                full-width
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
              </RetroSelect>
            </div>

            <div
              v-if="selectedCommandType"
              class="form-group"
            >
              <label>{{ $t('ui.debug.tool.command') }}</label>
              <RetroSelect
                v-model="selectedCommand"
                size="md"
                full-width
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
              </RetroSelect>
            </div>
          </div>

          <div
            v-if="selectedCommand !== ''"
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
                @input="onLengthInput"
              >
            </div>
          </div>

          <div
            v-if="selectedCommand !== ''"
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
                @input="receiveLengthDirty = true"
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
            v-if="selectedCommand !== ''"
            class="form-group"
          >
            <div class="label-row">
              <label>{{ $t('ui.debug.tool.data') }} ({{ $t('ui.debug.tool.optional') }})</label>
              <span
                v-if="data.trim()"
                class="hex-status"
                :class="{ 'hex-status--error': Boolean(dataValidationError) }"
              >
                {{ dataValidationError || `${parsedDataByteCount} ${$t('ui.debug.tool.bytes')}` }}
              </span>
            </div>
            <textarea
              v-model="data"
              :class="{ 'is-invalid': Boolean(dataValidationError) }"
              :placeholder="$t('ui.debug.tool.dataPlaceholder')"
              rows="4"
            />
            <small class="form-hint">{{ $t('ui.debug.tool.dataHint') }}</small>
          </div>

          <div class="form-actions">
            <RetroButton
              variant="primary"
              :icon="isSending ? 'pixelarticons:hourglass' : 'pixelarticons:play'"
              :text="isSending ? $t('ui.debug.tool.sending') : $t('ui.debug.tool.send')"
              :disabled="!canSend || isSending || connectionBusy || !hasDevice || !supportsDebug"
              @click="sendCommand"
            />

            <RetroButton
              variant="secondary"
              icon="pixelarticons:reload"
              :text="$t('ui.debug.tool.clear')"
              @click="clearForm"
            />
          </div>
        </div>

        <div class="debug-output">
          <div class="output-section">
            <div class="output-header">
              <h4>{{ $t('ui.debug.tool.request') }}</h4>
              <div
                v-if="requestData"
                class="output-actions"
              >
                <span class="byte-pill">{{ requestData.length }} {{ $t('ui.debug.tool.bytes') }}</span>
                <button
                  type="button"
                  class="output-action-btn"
                  @click="copyHexBytes('request', requestData)"
                >
                  {{ copiedTarget === 'request' ? $t('ui.debug.tool.copied') : $t('ui.debug.tool.copy') }}
                </button>
              </div>
            </div>
            <div class="data-display">
              <div
                v-if="requestData"
                class="dump-table"
                :class="{ 'dump-table--hex-only': outputFormat === 'hex' }"
              >
                <div
                  v-for="row in buildHexDumpRows(requestData)"
                  :key="row.offset"
                  class="dump-row"
                >
                  <span
                    v-if="outputFormat === 'dump'"
                    class="dump-offset"
                  >{{ row.offset }}:</span>
                  <span class="dump-hex">{{ row.hex }}</span>
                  <span
                    v-if="outputFormat === 'dump'"
                    class="dump-ascii"
                  >|{{ row.ascii }}|</span>
                </div>
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
            <div class="output-header">
              <h4>{{ $t('ui.debug.tool.response') }}</h4>
              <div class="output-actions">
                <div
                  v-if="requestData || responseData"
                  class="view-toggle"
                  role="group"
                >
                  <button
                    type="button"
                    class="view-toggle__btn"
                    :class="{ 'is-active': outputFormat === 'hex' }"
                    @click="outputFormat = 'hex'"
                  >
                    {{ $t('ui.debug.tool.viewHex') }}
                  </button>
                  <button
                    type="button"
                    class="view-toggle__btn"
                    :class="{ 'is-active': outputFormat === 'dump' }"
                    @click="outputFormat = 'dump'"
                  >
                    {{ $t('ui.debug.tool.viewDump') }}
                  </button>
                </div>
                <button
                  v-if="responseData"
                  type="button"
                  class="output-action-btn"
                  @click="copyHexBytes('response', responseData)"
                >
                  {{ copiedTarget === 'response' ? $t('ui.debug.tool.copied') : $t('ui.debug.tool.copy') }}
                </button>
              </div>
            </div>
            <div class="data-display">
              <div
                v-if="responseData"
                class="dump-table"
                :class="{ 'dump-table--hex-only': outputFormat === 'hex' }"
              >
                <div
                  v-for="row in buildHexDumpRows(responseData)"
                  :key="row.offset"
                  class="dump-row"
                >
                  <span
                    v-if="outputFormat === 'dump'"
                    class="dump-offset"
                  >{{ row.offset }}:</span>
                  <span class="dump-hex">{{ row.hex }}</span>
                  <span
                    v-if="outputFormat === 'dump'"
                    class="dump-ascii"
                  >|{{ row.ascii }}|</span>
                </div>
              </div>
              <div
                v-else-if="errorMessage"
                class="data-error"
              >
                <RetroIcon icon="pixelarticons:alert" />
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
            <div class="output-header">
              <h4>{{ $t('ui.debug.tool.analysis') }}</h4>
            </div>
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
    </div>
  </RetroModal>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { RetroBadge, RetroButton, RetroIcon, RetroModal, RetroSelect } from '@/components/retro';
import { useConnectionOperationBusy } from '@/composables/useConnectionOperationBusy';
import { useToast } from '@/composables/useToast';
import { displayTextToString } from '@/device/display';
import {
  type DebugCommandType,
  executeDebugCommand,
  getAvailableDebugCommands,
  isDuplicatedDebugCommandName,
} from '@/services/debug-protocol-service';
import { DeviceConnectionManager } from '@/services/device-connection-manager';
import type { DeviceInfo } from '@/types/device-info';

interface CommandHistoryItem {
  id: number;
  label: string;
  summary: string;
  commandType: DebugCommandType;
  command: number;
  address: string;
  length: number | '';
  data: string;
  receiveLength: number | '';
  timeout: number | '';
}

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
const { connectionBusy } = useConnectionOperationBusy();

const localVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => {
    emit('update:modelValue', value);
  },
});

const selectedCommandType = ref<DebugCommandType | ''>('');
const selectedCommand = ref<number | ''>('');
const address = ref('');
const length = ref<number | ''>('');
const data = ref('');
const receiveLength = ref<number | ''>('');
const timeout = ref<number | ''>('');
const receiveLengthDirty = ref(false);

const requestData = ref<Uint8Array | null>(null);
const responseData = ref<Uint8Array | null>(null);
const errorMessage = ref('');
const executionTime = ref(0);
const isSending = ref(false);
const outputFormat = ref<'hex' | 'dump'>('hex');
const copiedTarget = ref<'request' | 'response' | null>(null);
const commandHistory = ref<CommandHistoryItem[]>([]);
let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
let historyIdCounter = 0;

const hasDevice = computed(() => Boolean(props.device?.transport ?? props.device?.serialHandle?.transport));
/** Raw debug commands require the session's `tool.debug` capability. */
const supportsDebug = computed(() => props.device?.session?.capabilities.has('tool.debug') ?? false);
const deviceLabel = computed(() => {
  if (!props.device) return '';
  const session = props.device.session;
  if (session) return displayTextToString(session.display.title);
  return props.device.portInfo?.path ?? '';
});

const availableCommands = computed(() => {
  return getAvailableDebugCommands(selectedCommandType.value);
});

const dataValidationError = computed(() => {
  const raw = data.value.trim();
  if (!raw) return '';
  if (/[^0-9a-fA-F\s]/.test(raw)) {
    return t('ui.debug.tool.errors.invalidHexData');
  }
  const cleaned = raw.replace(/\s+/g, '');
  if (cleaned.length % 2 !== 0) {
    return t('ui.debug.tool.errors.invalidHexLength');
  }
  return '';
});

const parsedDataByteCount = computed(() => {
  if (dataValidationError.value) return 0;
  const cleaned = data.value.replace(/\s+/g, '');
  return cleaned.length / 2;
});

const canSend = computed(() => {
  return Boolean(selectedCommandType.value)
    && selectedCommand.value !== ''
    && receiveLength.value !== ''
    && !dataValidationError.value;
});

function isReadCommand(command: number, commandType: DebugCommandType): boolean {
  if (commandType === 'GBA') {
    return command === 0xf6 || command === 0xf8;
  }
  return command === 0xfb;
}

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
      case 0xf8: { // RAM_READ
        const defaultReadLength = length.value !== '' ? length.value + 2 : 258;
        receiveLength.value = defaultReadLength;
        break;
      }
      default:
        receiveLength.value = 64;
    }
  } else if (commandType === 'GBC') {
    switch (command) {
      case 0xfa: // DIRECT_WRITE
      case 0xfc: // ROM_PROGRAM
        receiveLength.value = 1;
        break;
      case 0xfb: { // READ
        const defaultReadLength = length.value !== '' ? length.value + 2 : 258;
        receiveLength.value = defaultReadLength;
        break;
      }
      default:
        receiveLength.value = 64;
    }
  }
}

function onCommandTypeChange() {
  selectedCommand.value = '';
  receiveLength.value = '';
  receiveLengthDirty.value = false;
  clearOutput();
}

function onCommandChange() {
  receiveLengthDirty.value = false;
  if (typeof selectedCommand.value === 'number' && selectedCommandType.value) {
    setDefaultReceiveLength(selectedCommand.value, selectedCommandType.value);
  }
}

function onLengthInput() {
  if (
    !receiveLengthDirty.value
    && typeof selectedCommand.value === 'number'
    && selectedCommandType.value
    && isReadCommand(selectedCommand.value, selectedCommandType.value)
  ) {
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
  receiveLengthDirty.value = false;
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

  if (isDuplicatedDebugCommandName(key)) {
    return `${selectedCommandType.value}_${key} (${hexValue})`;
  }

  return `${key} (${hexValue})`;
}

function findCommandLabel(commandType: DebugCommandType, command: number): string {
  const cmds = getAvailableDebugCommands(commandType);
  for (const [key, value] of Object.entries(cmds)) {
    if (value === command) {
      return `${commandType}:${key}`;
    }
  }
  return `${commandType}:0x${command.toString(16).toUpperCase().padStart(2, '0')}`;
}

function recordHistory(commandType: DebugCommandType, command: number) {
  const label = findCommandLabel(commandType, command);
  const entry: CommandHistoryItem = {
    id: ++historyIdCounter,
    label,
    summary: `${label} len=${length.value || '-'} rx=${receiveLength.value || '-'}`,
    commandType,
    command,
    address: address.value,
    length: length.value,
    data: data.value,
    receiveLength: receiveLength.value,
    timeout: timeout.value,
  };
  const filtered = commandHistory.value.filter(
    item => !(
      item.commandType === entry.commandType
      && item.command === entry.command
      && item.address === entry.address
      && item.length === entry.length
      && item.data === entry.data
    ),
  );
  commandHistory.value = [entry, ...filtered].slice(0, 8);
}

function applyHistoryItem(item: CommandHistoryItem) {
  selectedCommandType.value = item.commandType;
  selectedCommand.value = item.command;
  address.value = item.address;
  length.value = item.length;
  data.value = item.data;
  receiveLength.value = item.receiveLength;
  timeout.value = item.timeout;
  receiveLengthDirty.value = true;
}

function parseHexString(hexStr: string): Uint8Array {
  if (/[^0-9a-fA-F\s]/.test(hexStr)) {
    throw new Error(t('ui.debug.tool.errors.invalidHexData'));
  }
  const cleaned = hexStr.replace(/\s+/g, '');
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

function handleFormKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    if (canSend.value && !isSending.value && !connectionBusy.value && hasDevice.value) {
      event.preventDefault();
      void sendCommand();
    }
  }
}

async function copyHexBytes(target: 'request' | 'response', bytes: Uint8Array) {
  const text = formatHexData(bytes);
  try {
    await navigator.clipboard?.writeText(text);
    copiedTarget.value = target;
    if (copyFeedbackTimer) clearTimeout(copyFeedbackTimer);
    copyFeedbackTimer = setTimeout(() => {
      copiedTarget.value = null;
    }, 1500);
  } catch {
    showToast(t('ui.debug.tool.errors.commandFailed'), 'error');
  }
}

async function sendCommand() {
  if (!canSend.value) return;

  const device = props.device;
  if (!device) {
    showToast(t('ui.debug.tool.errors.noDevice'), 'error');
    return;
  }

  isSending.value = true;
  clearOutput();

  try {
    const startTime = performance.now();

    const parsedAddress = parseAddress(address.value);
    let dataBytes: Uint8Array | null = null;
    if (data.value.trim()) {
      dataBytes = parseHexString(data.value);
    }

    const maxResponseLength = receiveLength.value !== '' ? receiveLength.value : 4096;
    const timeoutMs = timeout.value !== '' ? timeout.value : undefined;
    if (typeof selectedCommand.value !== 'number' || !selectedCommandType.value) {
      throw new Error(t('ui.debug.tool.errors.commandFailed'));
    }

    const transport = device.transport ?? device.serialHandle?.transport;
    if (!transport) {
      throw new Error(t('ui.debug.tool.errors.noDevice'));
    }

    recordHistory(selectedCommandType.value, selectedCommand.value);

    const opResult = await DeviceConnectionManager.getInstance().runConnectionOperation({
      expectedGeneration: device.connectionGeneration,
      requireConnected: false,
      fn: () => executeDebugCommand({
        transport,
        command: selectedCommand.value as number,
        address: parsedAddress,
        length: length.value === '' ? null : length.value,
        data: dataBytes,
        receiveLength: maxResponseLength,
        timeoutMs,
      }),
    });
    if (!opResult.ok) {
      if (opResult.reason === 'busy') {
        showToast(t('ui.operation.busy'), 'error');
        return;
      }
      throw opResult.error instanceof Error ? opResult.error : new Error(opResult.message);
    }

    const result = opResult.value;
    requestData.value = result.requestData;
    responseData.value = result.responseData;

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

  const lines = [];
  for (let i = 0; i < hexString.length; i += 48) {
    lines.push(hexString.slice(i, i + 47));
  }
  return lines.join('\n');
}

interface HexDumpRow {
  offset: string;
  hex: string;
  ascii: string;
}

function buildHexDumpRows(hexData: Uint8Array): HexDumpRow[] {
  const rows: HexDumpRow[] = [];
  for (let offset = 0; offset < hexData.length; offset += 16) {
    const slice = hexData.subarray(offset, offset + 16);
    const offsetStr = offset.toString(16).toUpperCase().padStart(4, '0');
    const hexParts = Array.from(slice).map(b => b.toString(16).toUpperCase().padStart(2, '0'));
    const ascii = Array.from(slice)
      .map(b => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.'))
      .join('');
    rows.push({
      offset: offsetStr,
      hex: hexParts.join(' '),
      ascii,
    });
  }
  return rows;
}

onUnmounted(() => {
  if (copyFeedbackTimer) {
    clearTimeout(copyFeedbackTimer);
    copyFeedbackTimer = null;
  }
});
</script>

<style lang="scss" scoped>
@use '@/styles/variables/spacing' as spacing-vars;
@use '@/styles/variables/typography' as typography-vars;
@use '@/styles/variables/radius' as radius-vars;
@use '@/styles/mixins' as mixins;

.debug-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: spacing-vars.$space-3;
  width: 100%;
}

.debug-modal-header__left,
.debug-modal-header__right {
  display: flex;
  align-items: center;
  gap: spacing-vars.$space-2;
  min-width: 0;
}

.retro-modal-title {
  margin: 0;
  font-family: var(--retro-font-display);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--retro-ink);
}

.debug-tool-shell {
  @include mixins.flex-column;
  gap: spacing-vars.$space-3;
}

.device-label,
.shortcut-hint {
  font-family: var(--retro-font-mono);
  font-size: typography-vars.$font-size-xs;
  color: var(--retro-ink-muted);
  white-space: nowrap;
}

.history-bar {
  display: flex;
  align-items: center;
  gap: spacing-vars.$space-2;
  padding: spacing-vars.$space-1 spacing-vars.$space-2;
  background: var(--retro-bg-elevated);
  border: 1px solid var(--retro-border-subtle);
  border-radius: radius-vars.$radius-base;
  min-width: 0;
}

.history-bar__label {
  font-size: typography-vars.$font-size-xs;
  font-weight: typography-vars.$font-weight-semibold;
  color: var(--retro-ink-muted);
  white-space: nowrap;
}

.history-bar__items {
  display: flex;
  align-items: center;
  gap: spacing-vars.$space-1;
  overflow-x: auto;
  flex: 1;
  min-width: 0;
}

.history-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: var(--retro-bg-surface);
  color: var(--retro-ink);
  border: 1px solid var(--retro-border-subtle);
  border-radius: radius-vars.$radius-sm;
  font-family: var(--retro-font-mono);
  font-size: typography-vars.$font-size-xs;
  white-space: nowrap;
  flex-shrink: 0;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;

  &:hover {
    border-color: var(--retro-border);
    background: var(--retro-bg-surface-hover, var(--retro-bg-elevated));
  }
}

.history-chip__addr {
  color: var(--retro-ink-muted);
}

.history-clear-btn {
  background: transparent;
  border: none;
  color: var(--retro-ink-muted);
  font-size: typography-vars.$font-size-xs;
  white-space: nowrap;
  cursor: pointer;
  padding: 2px 6px;

  &:hover {
    color: var(--retro-ink);
  }
}

.debug-tool {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
  gap: spacing-vars.$space-4;
  align-items: start;
}

@media (max-width: 860px) {
  .debug-tool {
    grid-template-columns: minmax(0, 1fr);
  }

  .shortcut-hint {
    display: none;
  }
}

.debug-form {
  @include mixins.flex-column;
  gap: spacing-vars.$space-3;
  min-width: 0;
}

.form-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: spacing-vars.$space-3;
  align-items: start;
}

.form-group {
  @include mixins.flex-column;
  gap: spacing-vars.$space-2;

  label {
    font-weight: typography-vars.$font-weight-semibold;
    color: var(--retro-ink);
    font-size: typography-vars.$font-size-sm;
  }

  input,
  textarea {
    padding: spacing-vars.$space-2 spacing-vars.$space-3;
    background: var(--retro-bg-surface);
    color: var(--retro-ink);
    border: 1.5px solid var(--retro-border-subtle);
    border-radius: radius-vars.$radius-base;
    font-size: typography-vars.$font-size-sm;
    font-family: var(--retro-font-mono);

    &:focus {
      outline: none;
      border-color: var(--retro-border);
    }
  }

  textarea.is-invalid {
    border-color: var(--color-error);
  }
}

.label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: spacing-vars.$space-2;
}

.hex-status {
  font-family: var(--retro-font-mono);
  font-size: typography-vars.$font-size-xs;
  color: var(--retro-ink-muted);

  &--error {
    color: var(--color-error);
  }
}

.form-hint {
  color: var(--retro-ink-muted);
  font-size: typography-vars.$font-size-xs;
}

.form-actions {
  display: flex;
  gap: spacing-vars.$space-3;
  margin-top: auto;
}

.debug-output {
  @include mixins.flex-column;
  gap: spacing-vars.$space-3;
  min-width: 0;
}

.output-section {
  background: var(--retro-bg-elevated);
  border: 1.5px solid var(--retro-border-subtle);
  border-radius: radius-vars.$radius-base;
  overflow: hidden;
  min-width: 0;
}

.output-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: spacing-vars.$space-2;
  padding: spacing-vars.$space-2 spacing-vars.$space-3;
  background: var(--retro-bg-surface);
  border-bottom: 1px solid var(--retro-border-subtle);

  h4 {
    margin: 0;
    font-size: typography-vars.$font-size-sm;
    font-weight: typography-vars.$font-weight-semibold;
    color: var(--retro-ink);
  }
}

.output-actions {
  display: flex;
  align-items: center;
  gap: spacing-vars.$space-2;
}

.byte-pill {
  font-family: var(--retro-font-mono);
  font-size: typography-vars.$font-size-xs;
  color: var(--retro-ink-muted);
}

.output-action-btn,
.view-toggle__btn {
  padding: 2px 8px;
  font-family: var(--retro-font-mono);
  font-size: typography-vars.$font-size-xs;
  background: var(--retro-bg-elevated);
  color: var(--retro-ink-muted);
  border: 1px solid var(--retro-border-subtle);
  border-radius: radius-vars.$radius-sm;
  cursor: pointer;

  &:hover {
    color: var(--retro-ink);
    border-color: var(--retro-border);
  }
}

.view-toggle__btn.is-active {
  color: var(--retro-ink);
  border-color: var(--retro-border);
}

.view-toggle {
  display: inline-flex;
  gap: 2px;
}

.data-display {
  padding: spacing-vars.$space-3;
  max-height: 220px;
  overflow: auto;
}

.dump-table {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: max-content;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  line-height: 1.5;
  color: var(--retro-ink);
  background: var(--retro-bg-surface);
  padding: spacing-vars.$space-3;
  border-radius: radius-vars.$radius-sm;
  border: 1px solid var(--retro-border-subtle);
}

.dump-row {
  display: grid;
  grid-template-columns: 5ch 47ch auto;
  align-items: baseline;
  column-gap: 1.5ch;
  white-space: pre;
}

.dump-table--hex-only .dump-row {
  grid-template-columns: 1fr;
}

.dump-offset {
  color: var(--retro-ink-muted);
}

.dump-ascii {
  color: var(--retro-ink-muted);
}

.data-placeholder {
  @include mixins.flex-center;
  color: var(--retro-ink-muted);
  font-style: italic;
  height: 68px;
}

.data-error {
  display: flex;
  align-items: center;
  gap: spacing-vars.$space-2;
  color: var(--color-error);
  background: var(--color-error-light);
  padding: spacing-vars.$space-3;
  border-radius: radius-vars.$radius-sm;
  border: 1px solid var(--color-error-light);
}

.analysis-display {
  padding: spacing-vars.$space-3;
}

.analysis-item {
  @include mixins.flex-between;
  padding: spacing-vars.$space-2 0;
  border-bottom: 1px solid var(--retro-divider);

  &:last-child {
    border-bottom: none;
  }

  .label {
    font-weight: typography-vars.$font-weight-medium;
    color: var(--retro-ink);
  }

  .value {
    font-family: var(--retro-font-mono);
    color: var(--retro-ink);
    font-weight: typography-vars.$font-weight-semibold;
  }
}
</style>
