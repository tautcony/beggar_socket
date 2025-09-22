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

<style lang="scss" scoped>
@use '@/styles/variables/colors' as color-vars;
@use '@/styles/variables/spacing' as spacing-vars;
@use '@/styles/variables/typography' as typography-vars;
@use '@/styles/variables/radius' as radius-vars;
@use '@/styles/mixins' as mixins;

.port-selector-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  @include mixins.flex-center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.port-selector-modal {
  background: color-vars.$color-bg;
  border-radius: radius-vars.$radius-xl;
  box-shadow: color-vars.$shadow-lg;
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
  @include mixins.flex-between;
  padding: spacing-vars.$space-5 spacing-vars.$space-6;
  border-bottom: 1px solid color-vars.$color-border-light;

  h3 {
    margin: 0;
    font-size: typography-vars.$font-size-xl;
    font-weight: typography-vars.$font-weight-semibold;
    color: color-vars.$color-text;
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: spacing-vars.$space-2;
}

.refresh-button {
  display: flex;
  align-items: center;
  gap: spacing-vars.$space-1;
  background: color-vars.$color-bg-tertiary;
  border: 1px solid color-vars.$color-border;
  border-radius: radius-vars.$radius-base;
  padding: spacing-vars.$space-2 spacing-vars.$space-3;
  font-size: typography-vars.$font-size-xs;
  color: color-vars.$color-text;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: color-vars.$color-bg-secondary;
    border-color: color-vars.$color-border-light;
  }
}

.close-button {
  background: none;
  border: none;
  font-size: typography-vars.$font-size-xl;
  color: color-vars.$color-text-secondary;
  cursor: pointer;
  padding: spacing-vars.$space-1;
  border-radius: radius-vars.$radius-sm;
  transition: all 0.2s;

  &:hover {
    background: color-vars.$color-bg-tertiary;
    color: color-vars.$color-text;
  }
}

.modal-body {
  padding: spacing-vars.$space-5 spacing-vars.$space-6;
  max-height: 400px;
  overflow-y: auto;
}

.description {
  margin: 0 0 spacing-vars.$space-4 0;
  color: color-vars.$color-text-secondary;
  font-size: typography-vars.$font-size-sm;
  line-height: typography-vars.$line-height-normal;
}

.port-list {
  @include mixins.flex-column;
  gap: spacing-vars.$space-2;
}

.port-item {
  display: flex;
  align-items: center;
  padding: spacing-vars.$space-4;
  border: 2px solid color-vars.$color-border-light;
  border-radius: radius-vars.$radius-lg;
  cursor: pointer;
  transition: all 0.2s;
  background: color-vars.$color-bg;

  &:hover {
    border-color: color-vars.$color-primary;
    background: rgba(color-vars.$color-primary, 0.1);
  }

  &.selected {
    border-color: color-vars.$color-primary;
    background: rgba(color-vars.$color-primary, 0.1);
    box-shadow: color-vars.$shadow-sm;

    .port-icon {
      background: rgba(color-vars.$color-primary, 0.2);
      color: color-vars.$color-primary;
    }
  }
}

.port-icon {
  @include mixins.flex-center;
  width: 40px;
  height: 40px;
  background: color-vars.$color-bg-tertiary;
  border-radius: radius-vars.$radius-lg;
  margin-right: spacing-vars.$space-3;
  color: color-vars.$color-text-secondary;
  font-size: typography-vars.$font-size-xl;
}

.port-info {
  flex: 1;
  min-width: 0;
}

.port-path {
  font-weight: typography-vars.$font-weight-semibold;
  color: color-vars.$color-text;
  font-size: typography-vars.$font-size-sm;
  margin-bottom: spacing-vars.$space-1;
}

.port-manufacturer {
  color: color-vars.$color-text-secondary;
  font-size: typography-vars.$font-size-xs;
  margin-bottom: spacing-vars.$space-1;
}

.port-serial {
  color: color-vars.$color-text-tertiary;
  font-size: typography-vars.$font-size-xs;
  font-family: monospace;
}

.port-indicator {
  @include mixins.flex-center;
  width: 24px;
  height: 24px;
}

.selected-icon {
  color: color-vars.$color-success;
  font-size: typography-vars.$font-size-xl;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: spacing-vars.$space-3;
  padding: spacing-vars.$space-5 spacing-vars.$space-6;
  border-top: 1px solid color-vars.$color-border-light;
  background: color-vars.$color-bg-secondary;
}

.button {
  padding: spacing-vars.$space-2 spacing-vars.$space-4;
  border-radius: radius-vars.$radius-base;
  font-size: typography-vars.$font-size-sm;
  font-weight: typography-vars.$font-weight-medium;
  cursor: pointer;
  transition: all 0.2s;
  border: none;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &.secondary {
    background: color-vars.$color-bg;
    color: color-vars.$color-text;
    border: 1px solid color-vars.$color-border;

    &:hover:not(:disabled) {
      background: color-vars.$color-bg-secondary;
      border-color: color-vars.$color-border-light;
    }
  }

  &.primary {
    @include mixins.button-variant(white, color-vars.$color-primary);
  }
}
</style>
