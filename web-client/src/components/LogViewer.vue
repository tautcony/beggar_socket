<template>
  <div class="log-section">
    <div class="log-header">
      <h2>{{ $t('ui.log.title') }}</h2>
      <button
        class="log-clear"
        @click="clearLog"
      >
        {{ $t('ui.log.clear') }}
      </button>
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
      <div
        ref="scrollAnchor"
        class="scroll-anchor"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onUnmounted, ref, useTemplateRef, watch } from 'vue';

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
const scrollAnchor = useTemplateRef<HTMLDivElement>('scrollAnchor');
const isUserScrolling = ref(false);
const scrollTimeout = ref<ReturnType<typeof setTimeout>>();

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
      logBox.value.scrollTop = logBox.value.scrollHeight;
    }
  });
}

// 自动滚动到底部
watch(() => props.logs, async () => {
  if (!props.autoScroll || isUserScrolling.value) {
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

    // 初始滚动到底部
    if (props.autoScroll) {
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
  height: calc(820px - 44px);
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

.scroll-anchor {
  height: 1px;
  width: 1px;
}
</style>
