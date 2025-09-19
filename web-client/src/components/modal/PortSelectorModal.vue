<template>
  <div
    v-if="visible"
    class="port-selector-overlay"
    @click.self="onCancel"
  >
    <div class="port-selector-modal">
      <div class="modal-header">
        <h3>{{ $t('ui.device.portSelector.title') }}</h3>
        <div class="header-actions">
          <button
            class="refresh-button"
            @click="onRefresh"
          >
            <IonIcon :icon="refreshOutline" />
            {{ $t('ui.device.portSelector.refresh') }}
          </button>
          <button
            class="close-button"
            @click="onCancel"
          >
            <IonIcon :icon="close" />
          </button>
        </div>
      </div>

      <div class="modal-body">
        <p class="description">
          {{ $t('ui.device.portSelector.description') }}
        </p>

        <div class="port-list">
          <div
            v-for="(port, index) in ports"
            :key="port.path"
            class="port-item"
            :class="{ selected: selectedIndex === index }"
            @click="selectedIndex = index"
          >
            <div class="port-icon">
              <IonIcon :icon="hardwareChipOutline" />
            </div>
            <div class="port-info">
              <div class="port-path">
                {{ port.path }}
              </div>
              <div
                v-if="port.manufacturer"
                class="port-manufacturer"
              >
                {{ port.manufacturer }}
              </div>
              <div
                v-if="port.serialNumber"
                class="port-serial"
              >
                {{ $t('ui.device.portSelector.serialNumber') }}: {{ port.serialNumber }}
              </div>
            </div>
            <div class="port-indicator">
              <IonIcon
                v-if="selectedIndex === index"
                :icon="checkmarkCircle"
                class="selected-icon"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button
          class="button secondary"
          @click="onCancel"
        >
          {{ $t('ui.device.portSelector.cancel') }}
        </button>
        <button
          class="button primary"
          :disabled="selectedIndex === -1"
          @click="onConfirm"
        >
          {{ $t('ui.device.portSelector.connect') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { checkmarkCircle, close, hardwareChipOutline, refreshOutline } from 'ionicons/icons';
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { SerialPortInfo } from '@/services/serial-service';

interface Props {
  visible: boolean;
  ports: SerialPortInfo[];
}

interface Emits {
  (e: 'select', port: SerialPortInfo): void;
  (e: 'cancel' | 'refresh'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n();
const selectedIndex = ref(-1);

// 当对话框显示时重置选择
watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    selectedIndex.value = -1;
  }
});

const onConfirm = () => {
  if (selectedIndex.value >= 0 && selectedIndex.value < props.ports.length) {
    emit('select', props.ports[selectedIndex.value]);
  }
};

const onCancel = () => {
  emit('cancel');
};

const onRefresh = () => {
  selectedIndex.value = -1; // 重置选择
  emit('refresh');
};
</script>

<style scoped>
.port-selector-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.port-selector-modal {
  background: var(--color-bg);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow: hidden;
  animation: modalSlideIn 0.3s ease-out;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  border-bottom: var(--border-width) var(--border-style) var(--color-border-light);
}

.modal-header h3 {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.refresh-button {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  background: var(--color-bg-tertiary);
  border: var(--border-width) var(--border-style) var(--color-border);
  border-radius: var(--radius-base);
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-xs);
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.2s;
}

.refresh-button:hover {
  background: var(--color-bg-secondary);
  border-color: var(--color-border-light);
}

.close-button {
  background: none;
  border: none;
  font-size: var(--font-size-xl);
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  transition: all 0.2s;
}

.close-button:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text);
}

.modal-body {
  padding: var(--space-5) var(--space-6);
  max-height: 400px;
  overflow-y: auto;
}

.description {
  margin: 0 0 var(--space-4) 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.port-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.port-item {
  display: flex;
  align-items: center;
  padding: var(--space-4);
  border: var(--border-width-thick) var(--border-style) var(--color-border-light);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s;
  background: var(--color-bg);
}

.port-item:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.port-item.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
  box-shadow: var(--shadow-focus);
}

.port-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-lg);
  margin-right: var(--space-3);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xl);
}

.port-item.selected .port-icon {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.port-info {
  flex: 1;
  min-width: 0;
}

.port-path {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-1);
}

.port-manufacturer {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  margin-bottom: var(--space-1);
}

.port-serial {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  font-family: monospace;
}

.port-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

.selected-icon {
  color: var(--color-success);
  font-size: var(--font-size-xl);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-6);
  border-top: var(--border-width) var(--border-style) var(--color-border-light);
  background: var(--color-bg-secondary);
}

.button {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-base);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.button.secondary {
  background: var(--color-bg);
  color: var(--color-text);
  border: var(--border-width) var(--border-style) var(--color-border);
}

.button.secondary:hover:not(:disabled) {
  background: var(--color-bg-secondary);
  border-color: var(--color-border-light);
}

.button.primary {
  background: var(--color-primary);
  color: var(--color-text-inverse);
}

.button.primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}
</style>
