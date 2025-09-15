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
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
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
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.refresh-button {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 0.8rem;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s;
}

.refresh-button:hover {
  background: #e5e7eb;
  border-color: #9ca3af;
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #6b7280;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-button:hover {
  background: #f3f4f6;
  color: #374151;
}

.modal-body {
  padding: 20px 24px;
  max-height: 400px;
  overflow-y: auto;
}

.description {
  margin: 0 0 16px 0;
  color: #6b7280;
  font-size: 0.875rem;
  line-height: 1.5;
}

.port-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.port-item {
  display: flex;
  align-items: center;
  padding: 16px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
}

.port-item:hover {
  border-color: #3b82f6;
  background: #f8faff;
}

.port-item.selected {
  border-color: #3b82f6;
  background: #eff6ff;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.port-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: #f3f4f6;
  border-radius: 8px;
  margin-right: 12px;
  color: #6b7280;
  font-size: 1.25rem;
}

.port-item.selected .port-icon {
  background: #dbeafe;
  color: #3b82f6;
}

.port-info {
  flex: 1;
  min-width: 0;
}

.port-path {
  font-weight: 600;
  color: #1f2937;
  font-size: 0.875rem;
  margin-bottom: 2px;
}

.port-manufacturer {
  color: #6b7280;
  font-size: 0.8rem;
  margin-bottom: 1px;
}

.port-serial {
  color: #9ca3af;
  font-size: 0.75rem;
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
  color: #10b981;
  font-size: 1.25rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}

.button {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.button.secondary {
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
}

.button.secondary:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #9ca3af;
}

.button.primary {
  background: #3b82f6;
  color: white;
}

.button.primary:hover:not(:disabled) {
  background: #2563eb;
}
</style>
