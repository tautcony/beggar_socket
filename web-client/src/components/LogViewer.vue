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
        {{ line }}
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

const props = withDefaults(defineProps<{
  title?: string;
  logs: string[];
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
  margin-bottom: 12px;
  flex-shrink: 0;
  height: 32px;
}

.log-header h2 {
  margin: 0;
  font-size: 1.1rem;
  color: #333;
}

.log-clear {
  background: #f44336;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
}

.log-clear:hover {
  background: #d32f2f;
}

.log-area-scroll {
  background: #f4f4f4;
  border-radius: 6px;
  border: 1px solid #ccc;
  padding: 8px 8px 8px 12px;
  flex: 1;
  overflow-y: auto;
  font-family: monospace;
  font-size: 0.97rem;
  line-height: 1.6;
  height: calc(820px - 44px);
}

.log-area-scroll::-webkit-scrollbar {
  width: 6px;
}

.log-area-scroll::-webkit-scrollbar-track {
  background: #e8e8e8;
  border-radius: 3px;
}

.log-area-scroll::-webkit-scrollbar-thumb {
  background: #bbb;
  border-radius: 3px;
}

.log-area-scroll::-webkit-scrollbar-thumb:hover {
  background: #999;
}

.log-line {
  white-space: pre-wrap;
  word-break: break-all;
  text-align: left;
  font-size: small;
}

.scroll-anchor {
  height: 1px;
  width: 1px;
}

/* 移动端响应式 */
@media (max-width: 768px) {
  .log-section {
    width: 100%;
    height: 350px;
  }

  .log-area-scroll {
    height: calc(350px - 44px) !important;
  }
}
</style>
