<template>
  <div class="settings-link">
    <button
      class="settings-button"
      :title="$t('ui.settings.tooltip')"
      @click="$emit('click')"
    >
      <span class="settings-icon">⚙️</span>
      <span class="settings-text">{{ $t('ui.settings.title') }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
// 定义事件
defineEmits<{
  click: []
}>();
</script>

<style scoped>
.settings-link {
  position: fixed;
  bottom: 80px; /* GitHub 按钮上方 */
  right: 20px;
  z-index: 1000;
}

.settings-button {
  display: flex;
  align-items: center;
  background: #1976d2;
  color: white;
  padding: 8px 12px;
  border-radius: 25px;
  border: none;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
  transform: translateX(calc(100% - 40px));
  overflow: hidden;
  white-space: nowrap;
  cursor: pointer;
}

.settings-button:hover {
  background: #1565c0;
  transform: translateX(0);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
}

.settings-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.settings-text {
  margin-left: 8px;
  opacity: 0;
  transition: opacity 0.3s ease 0.1s;
}

.settings-button:hover .settings-text {
  opacity: 1;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .settings-link {
    bottom: 70px;
    right: 10px;
  }

  .settings-button {
    padding: 6px 10px;
    font-size: 12px;
  }

  .settings-icon {
    width: 18px;
    height: 18px;
    font-size: 14px;
  }
}
</style>
