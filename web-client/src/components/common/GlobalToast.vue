<template>
  <div class="toast-container">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      :class="['global-toast', toast.type]"
      @mouseenter="pauseTimer(toast.id)"
      @mouseleave="resumeTimer(toast.id)"
    >
      <div class="toast-content">
        <div class="toast-icon">
          <IonIcon
            v-if="toast.type === 'success'"
            :icon="checkmarkCircle"
          />
          <IonIcon
            v-else-if="toast.type === 'error'"
            :icon="closeCircle"
          />
          <IonIcon
            v-else
            :icon="informationCircle"
          />
        </div>
        <div class="toast-message">
          {{ toast.message }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { checkmarkCircle, closeCircle, informationCircle } from 'ionicons/icons';
import { onMounted, onUnmounted, ref } from 'vue';

interface Toast {
  id: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'idle';
  timer: ReturnType<typeof setTimeout> | null;
  duration: number;
  isPaused: boolean;
  remainingTime: number;
  pauseStartTime: number | null;
}

const toasts = ref<Toast[]>([]);
let toastIdCounter = 0;

function showToast(msg: string, toastType: 'info' | 'success' | 'error' | 'idle' = 'success', duration = 3000) {
  const id = ++toastIdCounter;

  const toast: Toast = {
    id,
    message: msg,
    type: toastType,
    timer: null,
    duration,
    isPaused: false,
    remainingTime: duration,
    pauseStartTime: null,
  };

  // 添加新的 toast
  toasts.value.push(toast);

  // 设置自动消失定时器
  startTimer(toast);
}

// 监听全局Toast事件
function handleGlobalToast(event: CustomEvent<{ message: string, type: 'info' | 'success' | 'error' | 'idle', duration: number }>) {
  const { message, type, duration } = event.detail;
  showToast(message, type, duration);
}

onMounted(() => {
  window.addEventListener('show-toast', handleGlobalToast as EventListener);
});

onUnmounted(() => {
  window.removeEventListener('show-toast', handleGlobalToast as EventListener);
});

function startTimer(toast: Toast) {
  toast.timer = setTimeout(() => {
    removeToast(toast.id);
  }, toast.remainingTime);
}

function pauseTimer(toastId: number) {
  const toast = toasts.value.find(t => t.id === toastId);
  if (toast?.timer && !toast.isPaused) {
    clearTimeout(toast.timer);
    toast.timer = null;
    toast.isPaused = true;
    toast.pauseStartTime = Date.now();
  }
}

function resumeTimer(toastId: number) {
  const toast = toasts.value.find(t => t.id === toastId);
  if (toast && toast.isPaused && toast.pauseStartTime) {
    const pauseDuration = Date.now() - toast.pauseStartTime;
    toast.remainingTime = Math.max(0, toast.remainingTime - pauseDuration);
    toast.isPaused = false;
    toast.pauseStartTime = null;

    if (toast.remainingTime > 0) {
      startTimer(toast);
    } else {
      removeToast(toastId);
    }
  }
}

function removeToast(toastId: number) {
  const index = toasts.value.findIndex(t => t.id === toastId);
  if (index > -1) {
    const toast = toasts.value[index];
    if (toast.timer) {
      clearTimeout(toast.timer);
    }
    toasts.value.splice(index, 1);
  }
}

declare global {
  interface Window {
    showToast?: (msg: string, type?: 'info' | 'success' | 'error' | 'idle', duration?: number) => void;
  }
}

if (typeof window !== 'undefined') {
  window.showToast = showToast;
}
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.global-toast {
  min-width: 180px;
  max-width: 320px;
  padding: 12px 16px;
  border-radius: 8px;
  color: #fff;
  font-size: 0.875rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
  opacity: 0.96;
  pointer-events: auto;
  cursor: default;
}

.global-toast:hover {
  opacity: 1;
  transform: translateX(-4px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.toast-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toast-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toast-message {
  flex: 1;
  line-height: 1.4;
  word-break: break-word;
  text-align: left;
}

.global-toast.success {
  background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
}

.global-toast.error {
  background: linear-gradient(135deg, #f44336 0%, #e53935 100%);
}

.global-toast.idle {
  background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
}

/* 动画效果 */
.global-toast {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 0.96;
  }
}
</style>
