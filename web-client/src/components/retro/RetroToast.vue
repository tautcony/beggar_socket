<template>
  <div class="retro-toast-container">
    <TransitionGroup
      name="retro-toast"
      tag="div"
      class="retro-toast-group"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="retro-toast-item"
        :class="`type-${toast.type}`"
        role="status"
        @mouseenter="pauseTimer(toast.id)"
        @mouseleave="resumeTimer(toast.id)"
      >
        <span class="retro-toast-indicator">
          <RetroIcon :icon="getIcon(toast.type)" />
        </span>
        <span class="retro-toast-message">{{ toast.message }}</span>
        <button
          type="button"
          class="retro-toast-close"
          @click="removeToast(toast.id)"
        >
          <RetroIcon icon="pixelarticons:close" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

import RetroIcon from './RetroIcon.vue';

export type RetroToastType = 'info' | 'success' | 'warning' | 'error' | 'idle';

interface ToastItem {
  id: number;
  message: string;
  type: RetroToastType;
  timer: ReturnType<typeof setTimeout> | null;
  remainingTime: number;
  pauseStartTime: number | null;
}

const toasts = ref<ToastItem[]>([]);
let toastIdCounter = 0;

function getIcon(type: RetroToastType): string {
  switch (type) {
    case 'success':
      return 'pixelarticons:checkbox-on';
    case 'error':
      return 'pixelarticons:close-box';
    case 'warning':
      return 'pixelarticons:warning-box';
    default:
      return 'pixelarticons:info-box';
  }
}

function showToast(message: string, type: RetroToastType = 'success', duration = 3000) {
  const id = ++toastIdCounter;
  const item: ToastItem = {
    id,
    message,
    type,
    timer: null,
    remainingTime: duration,
    pauseStartTime: null,
  };
  toasts.value.push(item);
  startTimer(item);
}

function startTimer(item: ToastItem) {
  if (item.remainingTime <= 0) {
    removeToast(item.id);
    return;
  }
  item.pauseStartTime = Date.now();
  item.timer = setTimeout(() => {
    removeToast(item.id);
  }, item.remainingTime);
}

function pauseTimer(id: number) {
  const item = toasts.value.find(t => t.id === id);
  if (item?.timer && item.pauseStartTime !== null) {
    clearTimeout(item.timer);
    item.timer = null;
    item.remainingTime = Math.max(0, item.remainingTime - (Date.now() - item.pauseStartTime));
    item.pauseStartTime = null;
  }
}

function resumeTimer(id: number) {
  const item = toasts.value.find(t => t.id === id);
  if (item && !item.timer) {
    startTimer(item);
  }
}

function removeToast(id: number) {
  const index = toasts.value.findIndex(t => t.id === id);
  if (index === -1) {
    return;
  }
  const [removed] = toasts.value.splice(index, 1);
  if (removed.timer) {
    clearTimeout(removed.timer);
  }
}

function handleGlobalToast(event: Event) {
  const custom = event as CustomEvent<{ message: string; type?: RetroToastType; duration?: number }>;
  showToast(custom.detail.message, custom.detail.type ?? 'info', custom.detail.duration ?? 3000);
}

declare global {
  interface Window {
    showToast?: (message: string, type?: RetroToastType, duration?: number) => void;
  }
}

onMounted(() => {
  window.addEventListener('show-toast', handleGlobalToast);
  if (typeof window !== 'undefined') {
    window.showToast = showToast;
  }
});

onUnmounted(() => {
  window.removeEventListener('show-toast', handleGlobalToast);
  if (typeof window !== 'undefined') {
    window.showToast = undefined;
  }
  toasts.value.forEach(t => {
    if (t.timer) {
      clearTimeout(t.timer);
    }
  });
});

defineExpose({
  showToast,
  removeToast,
});
</script>

<style scoped>
.retro-toast-container {
  position: fixed;
  top: var(--space-4);
  right: var(--space-4);
  z-index: 2000;
  pointer-events: none;
  max-width: min(380px, calc(100vw - 32px));
}

.retro-toast-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.retro-toast-item {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--retro-bg-surface);
  color: var(--retro-ink);
  border: 1.5px solid var(--retro-border);
  border-radius: 6px;
  box-shadow: var(--retro-shadow-card);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.retro-toast-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: 1px solid var(--retro-border);
  background: var(--retro-bg-tint);
  color: var(--retro-ink);
  font-size: 15px;
  flex-shrink: 0;
}

.retro-toast-item.type-success .retro-toast-indicator {
  background: var(--retro-success-bg);
}

.retro-toast-item.type-warning .retro-toast-indicator {
  background: var(--retro-warning-bg);
}

.retro-toast-item.type-error .retro-toast-indicator {
  background: var(--retro-danger-bg);
  color: var(--retro-danger-fg);
}

.retro-toast-message {
  flex: 1;
  min-width: 0;
  line-height: 1.35;
  word-break: break-word;
}

.retro-toast-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: var(--retro-ink-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.12s ease, color 0.12s ease;
}

.retro-toast-close:hover {
  background: var(--retro-bg-tint);
  color: var(--retro-ink);
}

.retro-toast-enter-active,
.retro-toast-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.retro-toast-enter-from {
  opacity: 0;
  transform: translateX(16px);
}

.retro-toast-leave-to {
  opacity: 0;
  transform: translateX(16px);
}
</style>
