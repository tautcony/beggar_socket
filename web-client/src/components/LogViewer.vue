<template>
  <div class="log-section">
    <div class="log-header">
      <h2>{{ $t('ui.log.title') }}</h2>
      <div class="log-header-actions">
        <BaseButton
          class="auto-scroll-button"
          :variant="autoScrollEnabled ? 'success' : 'primary'"
          size="sm"
          :icon="chevronDownOutline"
          :title="autoScrollEnabled ? $t('ui.log.autoScrollEnabled') : $t('ui.log.autoScrollDisabled')"
          @click="handleButtonClick"
          @dblclick="handleButtonDoubleClick"
        />
        <BaseButton
          class="log-clear"
          size="sm"
          :text="$t('ui.log.clear')"
          @click="clearLog"
        />
      </div>
    </div>
    <div
      ref="logBox"
      class="log-area-scroll"
    >
      <div
        v-for="(line, idx) in logs"
        :key="idx"
        class="log-line"
      >
        <span class="log-time">{{ line.time }}</span>
        <span
          class="log-message"
          :class="'log-' + line.level"
        >{{ line.message }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { chevronDownOutline } from 'ionicons/icons';
import { nextTick, onUnmounted, ref, useTemplateRef, watch } from 'vue';

import BaseButton from './common/BaseButton.vue';

type LogLevelType = 'info' | 'success' | 'warn' | 'error';

const props = withDefaults(defineProps<{
  title?: string;
  logs: { time: string; message: string; level: LogLevelType }[];
  maxHeight?: string;
  autoScroll?: boolean;
}>(), {
  title: 'Log',
  maxHeight: '350px',
  autoScroll: true,
});

const emit = defineEmits<{
  'clear-logs': [];
}>();

const logBox = useTemplateRef<HTMLDivElement>('logBox');
const scrollTimeout = ref<ReturnType<typeof setTimeout>>();
const isUserScrolling = ref(false);
const autoScrollEnabled = ref(false); // 将由detectAutoScrollState()决定初始状态

function clearLog() {
  emit('clear-logs');
}

// 检查是否滚动到底部
function isScrolledToBottom(): boolean {
  if (!logBox.value) return false;
  const { scrollTop, scrollHeight, clientHeight } = logBox.value;
  return Math.abs(scrollHeight - clientHeight - scrollTop) < 5; // 5px容差
}

// 处理用户滚动事件
function handleScroll() {
  // 用户手动滚动，暂时禁用自动滚动
  isUserScrolling.value = true;

  // 清除之前的超时
  if (scrollTimeout.value) {
    clearTimeout(scrollTimeout.value);
  }

  // 如果用户滚动到底部，重新启用自动滚动
  if (isScrolledToBottom()) {
    isUserScrolling.value = false;
  } else {
    // 2秒后重新启用自动滚动（如果仍在底部）
    scrollTimeout.value = setTimeout(() => {
      if (isScrolledToBottom()) {
        isUserScrolling.value = false;
      }
    }, 2000);
  }
}

// 滚动到底部的函数
function scrollToBottom() {
  if (!logBox.value) return;

  // 使用requestAnimationFrame确保DOM渲染完成
  requestAnimationFrame(() => {
    if (logBox.value) {
      // 精确计算滚动到底部的位置
      // scrollHeight - clientHeight 可以得到最大滚动距离
      const maxScrollTop = logBox.value.scrollHeight - logBox.value.clientHeight;
      logBox.value.scrollTop = maxScrollTop;
    }
  });
}

// 处理按钮点击事件
function handleButtonClick() {
  // 单机：滚动到底部
  scrollToBottom();
}

// 处理按钮双击事件
function handleButtonDoubleClick() {
  // 双击：切换持续自动下滚
  autoScrollEnabled.value = !autoScrollEnabled.value;

  // 如果启用了自动滚动，立即滚动到底部
  if (autoScrollEnabled.value) {
    scrollToBottom();
  }
}

// 智能检测是否需要启用自动滚动
function detectAutoScrollState() {
  // 如果日志数量较少，默认启用自动滚动
  // 如果日志数量较多，默认禁用，让用户手动控制
  const logCountThreshold = 50;
  autoScrollEnabled.value = props.logs.length <= logCountThreshold;
}

// 自动滚动到底部
watch(() => props.logs, async () => {
  // 检测是否需要调整自动滚动状态
  detectAutoScrollState();

  if (!autoScrollEnabled.value || isUserScrolling.value) {
    return;
  }

  await nextTick();
  await nextTick(); // 双重nextTick确保DOM完全更新

  scrollToBottom();
}, { deep: true, flush: 'post' });

// 组件挂载后设置滚动监听和初始滚动
watch(logBox, (newLogBox, oldLogBox) => {
  // 清理旧的事件监听器
  if (oldLogBox) {
    oldLogBox.removeEventListener('scroll', handleScroll);
  }

  if (newLogBox) {
    // 添加滚动事件监听
    newLogBox.addEventListener('scroll', handleScroll);

    // 智能检测是否需要启用自动滚动
    detectAutoScrollState();

    // 初始滚动到底部（如果启用了自动滚动）
    if (autoScrollEnabled.value) {
      scrollToBottom();
    }
  }
}, { immediate: true });

// 组件卸载时清理
onUnmounted(() => {
  if (logBox.value) {
    logBox.value.removeEventListener('scroll', handleScroll);
  }
  if (scrollTimeout.value) {
    clearTimeout(scrollTimeout.value);
  }
});
</script>

<style scoped>
.log-section {
  width: 450px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  height: 820px;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
  flex-shrink: 0;
  height: 32px;
}

.log-header h2 {
  margin: 0;
  font-size: var(--font-size-lg);
  color: var(--color-text);
}

.log-header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.log-clear {
  background-color: var(--color-error);
  color: white;
  border: none;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-base);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.log-clear:hover {
  background-color: #b71c1c;
}

.log-area-scroll {
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-3);
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  font-family: var(--font-family-mono);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
  word-break: break-all;
  white-space: pre-wrap;
}

.log-area-scroll::-webkit-scrollbar {
  width: 6px;
}

.log-area-scroll::-webkit-scrollbar-track {
  background: var(--color-scrollbar-track);
  border-radius: var(--radius-sm);
}

.log-area-scroll::-webkit-scrollbar-thumb {
  background: var(--color-scrollbar-thumb);
  border-radius: var(--radius-sm);
}

.log-area-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--color-scrollbar-thumb-hover);
}

.log-line {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  white-space: normal;
  word-break: break-all;
  text-align: left;
  font-size: var(--font-size-sm);
  gap: var(--space-2);
}

.log-time {
  color: var(--color-primary);
  font-weight: var(--font-weight-bold);
  min-width: 70px;
  flex-shrink: 0;
  text-align: right;
  line-height: var(--line-height-relaxed);
}

.log-message {
  color: var(--color-text);
  flex: 1 1 0;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: var(--line-height-relaxed);
}

.log-message.log-success {
  color: var(--color-success);
}

.log-message.log-warn {
  color: var(--color-warning);
}

.log-message.log-error {
  color: var(--color-error);
}
</style>
