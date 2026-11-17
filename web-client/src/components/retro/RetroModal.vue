<template>
  <Teleport to="body">
    <Transition name="retro-modal">
      <div
        v-if="modelValue"
        class="retro-modal-overlay"
        @click.self="onOverlayClick"
      >
        <div
          class="retro-modal-container"
          :style="containerStyle"
          role="dialog"
          aria-modal="true"
        >
          <header class="retro-modal-header">
            <slot name="header">
              <div class="retro-modal-title-group">
                <h3 class="retro-modal-title">
                  {{ title }}
                </h3>
                <span
                  v-if="badge"
                  class="retro-modal-badge"
                >
                  {{ badge }}
                </span>
              </div>
              <RetroButton
                variant="ghost"
                icon-only
                :icon="closeOutline"
                :disabled="closeDisabled"
                @click="hide"
              />
            </slot>
          </header>

          <div
            class="retro-modal-body"
            :style="bodyStyle"
          >
            <slot />
          </div>

          <footer
            v-if="$slots.footer"
            class="retro-modal-footer"
          >
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { closeOutline } from 'ionicons/icons';
import { computed, onMounted, onUnmounted } from 'vue';

import RetroButton from './RetroButton.vue';

const props = withDefaults(defineProps<{
  modelValue?: boolean;
  title?: string;
  badge?: string;
  closeDisabled?: boolean;
  width?: string | number;
  maxWidth?: string | number;
  maxHeight?: string | number;
  padding?: string;
  escClosable?: boolean;
  maskClosable?: boolean;
}>(), {
  modelValue: false,
  title: '',
  badge: undefined,
  closeDisabled: false,
  width: '500px',
  maxWidth: '92vw',
  maxHeight: '90vh',
  padding: 'var(--space-4)',
  escClosable: true,
  maskClosable: true,
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
}>();

const containerStyle = computed(() => ({
  width: typeof props.width === 'number' ? `${props.width}px` : props.width,
  maxWidth: typeof props.maxWidth === 'number' ? `${props.maxWidth}px` : props.maxWidth,
  maxHeight: typeof props.maxHeight === 'number' ? `${props.maxHeight}px` : props.maxHeight,
}));

const bodyStyle = computed(() => ({
  padding: props.padding,
}));

function onOverlayClick() {
  if (props.maskClosable && !props.closeDisabled) {
    hide();
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (props.modelValue && props.escClosable && !props.closeDisabled && e.key === 'Escape') {
    hide();
  }
}

function show() {
  emit('update:modelValue', true);
}

function hide() {
  emit('update:modelValue', false);
  emit('close');
}

function toggle() {
  if (props.modelValue) {
    hide();
  } else {
    show();
  }
}

defineExpose({
  show,
  hide,
  toggle,
});

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.retro-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: var(--retro-overlay);
  backdrop-filter: blur(2px);
}

.retro-modal-container {
  display: flex;
  flex-direction: column;
  background: var(--retro-bg-surface);
  color: var(--retro-ink);
  border: 1.5px solid var(--retro-border);
  border-radius: 6px;
  box-shadow: -4px 4px 0 var(--retro-shadow-color);
  overflow: hidden;
  box-sizing: border-box;
}

.retro-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 10px var(--space-4);
  background: var(--retro-bg-surface);
  border-bottom: 1.5px solid var(--retro-border);
  flex-shrink: 0;
}

.retro-modal-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.retro-modal-title {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  color: var(--retro-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.retro-modal-badge {
  font-family: var(--retro-font-mono);
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 4px;
  border: 1px solid var(--retro-border-subtle);
  background: var(--retro-bg-elevated);
  color: var(--retro-ink-muted);
  flex-shrink: 0;
}

.retro-modal-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  color: var(--retro-ink);
}

.retro-modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--retro-bg-elevated);
  border-top: 1px solid var(--retro-divider);
  flex-shrink: 0;
}

.retro-modal-enter-active,
.retro-modal-leave-active {
  transition: opacity 0.16s ease;
}

.retro-modal-enter-active .retro-modal-container,
.retro-modal-leave-active .retro-modal-container {
  transition: transform 0.16s ease;
}

.retro-modal-enter-from,
.retro-modal-leave-to {
  opacity: 0;
}

.retro-modal-enter-from .retro-modal-container,
.retro-modal-leave-to .retro-modal-container {
  transform: translate(3px, -3px) scale(0.98);
}
</style>
