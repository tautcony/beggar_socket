<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="modal-overlay"
      @click.self="onOverlayClick"
    >
      <div
        class="modal-container"
        :style="containerStyle"
      >
        <div class="modal-header">
          <template v-if="$slots.header">
            <slot name="header" />
          </template>
          <template v-else>
            <h3 class="modal-title">
              {{ title }}
            </h3>
            <button
              class="close-btn"
              :disabled="closeDisabled"
              @click="hide"
            >
              <IonIcon :icon="closeOutline" />
            </button>
          </template>
        </div>
        <div class="modal-body">
          <slot />
        </div>
        <div
          v-if="$slots.footer"
          class="modal-footer"
        >
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { closeOutline } from 'ionicons/icons';
import { computed, onMounted, onUnmounted } from 'vue';

const props = withDefaults(defineProps<{
  modelValue?: boolean;
  title?: string;
  closeDisabled?: boolean;
  width?: string | number;
  maxWidth?: string | number;
  maxHeight?: string | number;
  escClosable?: boolean;
  maskClosable?: boolean;
}>(), {
  modelValue: false,
  title: '',
  closeDisabled: false,
  width: '500px',
  maxWidth: '90vw',
  maxHeight: '90vh',
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

// 暴露的方法
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

// 暴露方法给模板引用
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

<style lang="scss" scoped>
@use '@/styles/variables/colors' as color-vars;
@use '@/styles/variables/spacing' as spacing-vars;
@use '@/styles/variables/typography' as typography-vars;
@use '@/styles/variables/radius' as radius-vars;
@use '@/styles/mixins' as mixins;

.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  @include mixins.flex-center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.modal-container {
  background: color-vars.$color-bg;
  border-radius: radius-vars.$radius-xl;
  box-shadow: color-vars.$shadow-lg;
  overflow: hidden;
  animation: modalSlideIn 0.3s ease-out;
  @include mixins.flex-column;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-header {
  @include mixins.flex-between;
  padding: spacing-vars.$space-5 spacing-vars.$space-6 spacing-vars.$space-4;
  border-bottom: 1px solid color-vars.$color-border-light;
}

.modal-title {
  margin: 0;
  font-size: typography-vars.$font-size-xl;
  font-weight: typography-vars.$font-weight-semibold;
  color: color-vars.$color-text;
}

.close-btn {
  background: none;
  border: none;
  font-size: typography-vars.$font-size-xl;
  cursor: pointer;
  color: color-vars.$color-text-secondary;
  padding: spacing-vars.$space-1;
  border-radius: radius-vars.$radius-base;
  transition: all 0.2s;
  width: 28px;
  height: 28px;
  @include mixins.flex-center;

  &:hover:not(:disabled) {
    background: color-vars.$color-bg-secondary;
    color: color-vars.$color-text;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.modal-body {
  padding: spacing-vars.$space-6;
  flex: 1 1 auto;
  overflow-y: auto;
}

.modal-footer {
  padding: spacing-vars.$space-4 spacing-vars.$space-6 spacing-vars.$space-5;
  border-top: 1px solid color-vars.$color-border-light;
  display: flex;
  justify-content: flex-end;
  gap: spacing-vars.$space-2;
}
</style>
