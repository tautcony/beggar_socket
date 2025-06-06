<template>
  <Teleport to="body">
    <div
      v-if="visible"
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
              @click="$emit('close')"
            >
              ×
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
import { computed, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  visible: Boolean,
  title: { type: String, default: '' },
  closeDisabled: { type: Boolean, default: false },
  width: { type: [String, Number], default: 500 },
  maxWidth: { type: [String, Number], default: '90vw' },
  maxHeight: { type: [String, Number], default: '90vh' },
  escClosable: { type: Boolean, default: true },
  maskClosable: { type: Boolean, default: true },
});

const emit = defineEmits(['close']);

const containerStyle = computed(() => ({
  width: typeof props.width === 'number' ? props.width + 'px' : props.width,
  maxWidth: typeof props.maxWidth === 'number' ? props.maxWidth + 'px' : props.maxWidth,
  maxHeight: typeof props.maxHeight === 'number' ? props.maxHeight + 'px' : props.maxHeight,
}));

function onOverlayClick() {
  if (props.maskClosable && !props.closeDisabled) emit('close');
}

function handleKeydown(e: KeyboardEvent) {
  if (props.visible && props.escClosable && !props.closeDisabled && e.key === 'Escape') {
    emit('close');
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});
onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}
.modal-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
  overflow: hidden;
  animation: modalSlideIn 0.3s ease-out;
  display: flex;
  flex-direction: column;
}
@keyframes modalSlideIn {
  from { opacity: 0; transform: scale(0.9) translateY(-20px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #e5e7eb;
}
.modal-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
}
.close-btn {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  color: #6b7280;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.close-btn:hover:not(:disabled) {
  background: #f3f4f6;
  color: #374151;
}
.close-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.modal-body {
  padding: 24px;
  flex: 1 1 auto;
  overflow-y: auto;
}
.modal-footer {
  padding: 16px 24px 20px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
