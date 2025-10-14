<template>
  <div class="toast-container">
    <transition-group
      name="toast"
      tag="div"
      class="toast-group"
      @before-leave="beforeLeave"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :ref="(el: any) => setToastRef(toast.id, el as HTMLElement)"
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
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { checkmarkCircle, closeCircle, informationCircle } from 'ionicons/icons';
import { onMounted, onUnmounted, ref } from 'vue';

type ToastType = 'info' | 'success' | 'error' | 'idle';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  timer: ReturnType<typeof setTimeout> | null;
  duration: number;
  isPaused: boolean;
  remainingTime: number;
  pauseStartTime: number | null;
}

const toasts = ref<Toast[]>([]);
const toastRefs = ref<Map<number, HTMLElement>>(new Map());
let toastIdCounter = 0;

function setToastRef(toastId: number, el: HTMLElement | null) {
  if (el) {
    toastRefs.value.set(toastId, el);
  } else {
    toastRefs.value.delete(toastId);
  }
}

function showToast(msg: string, toastType: ToastType = 'success', duration = 3000) {
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
function handleGlobalToast(event: CustomEvent<{ message: string, type: ToastType, duration: number }>) {
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

function beforeLeave(el: Element) {
  // 在离开动画开始前锁定宽度
  const htmlEl = el as HTMLElement;
  const currentWidth = htmlEl.getBoundingClientRect().width;
  htmlEl.style.width = `${currentWidth}px`;
  htmlEl.style.minWidth = `${currentWidth}px`;
  htmlEl.style.maxWidth = `${currentWidth}px`;
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

<style lang="scss" scoped>
@use '@/styles/variables/colors' as color-vars;
@use '@/styles/variables/spacing' as spacing-vars;
@use '@/styles/variables/typography' as typography-vars;
@use '@/styles/variables/radius' as radius-vars;
@use '@/styles/mixins' as mixins;

.toast-container {
  position: fixed;
  top: spacing-vars.$space-6;
  right: spacing-vars.$space-6;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: spacing-vars.$space-2;
  pointer-events: none;
}

.toast-group {
  display: flex;
  flex-direction: column;
  gap: spacing-vars.$space-2;
}

.global-toast {
  min-width: 180px;
  max-width: 320px;
  padding: spacing-vars.$space-3 spacing-vars.$space-4;
  border-radius: radius-vars.$radius-lg;
  color: color-vars.$color-toast-text;
  font-size: typography-vars.$font-size-sm;
  box-shadow: color-vars.$shadow-lg;
  transition: all 0.3s ease;
  opacity: 0.96;
  pointer-events: auto;
  cursor: default;

  &:hover {
    opacity: 1;
    transform: translateX(-4px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  }

  &.success {
    background: linear-gradient(135deg, color-vars.$color-toast-success-start 0%, color-vars.$color-toast-success-end 100%);
  }

  &.error {
    background: linear-gradient(135deg, color-vars.$color-toast-error-start 0%, color-vars.$color-toast-error-end 100%);
  }

  &.info,
  &.idle {
    background: linear-gradient(135deg, color-vars.$color-toast-info-start 0%, color-vars.$color-toast-info-end 100%);
  }
}

.toast-content {
  display: flex;
  align-items: center;
  gap: spacing-vars.$space-2;
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
  line-height: typography-vars.$line-height-normal;
  word-break: break-word;
  text-align: left;
}

/* 动画效果 */
.toast-enter-active {
  transition: all 0.3s ease-out;
}

.toast-leave-active {
  transition: transform 0.3s ease-out, opacity 0.3s ease-out;
  position: absolute;
  right: 0;
}

.toast-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.toast-enter-to {
  transform: translateX(0);
  opacity: 0.96;
}

.toast-leave-from {
  transform: translateX(0);
  opacity: 0.96;
}

.toast-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

.toast-move {
  transition: transform 0.3s ease-out;
}
</style>
