<template>
  <div
    v-if="visible"
    :class="['global-toast', type]"
  >
    {{ message }}
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const visible = ref(false);
const message = ref('');
const type = ref<'success' | 'error' | 'idle'>('success');
let timer: ReturnType<typeof setTimeout> | null = null;

function showToast(msg: string, toastType: 'success' | 'error' | 'idle' = 'success', duration = 3000) {
  if (timer) clearTimeout(timer);
  message.value = msg;
  type.value = toastType;
  visible.value = true;
  timer = setTimeout(() => {
    visible.value = false;
  }, duration);
}

// 通过 window 全局暴露 showToast
if (typeof window !== 'undefined') {
  window.showToast = showToast;
}
</script>

<style scoped>
.global-toast {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 2000;
  min-width: 180px;
  max-width: 320px;
  padding: 12px 24px;
  border-radius: 6px;
  color: #fff;
  font-size: 1rem;
  box-shadow: 0 2px 10px rgba(0,0,0,0.12);
  transition: opacity 0.3s, transform 0.3s;
  opacity: 0.98;
  pointer-events: none;
}
.global-toast.success {
  background: #4caf50;
}
.global-toast.error {
  background: #f44336;
}
.global-toast.idle {
  background: #2196f3;
}
</style>
