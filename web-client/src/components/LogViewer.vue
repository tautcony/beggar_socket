<template>
  <div class="log-section">
    <div class="log-header">
      <h2>{{ $t('ui.log.title') }}</h2>
      <div class="log-header-actions">
        <RetroButton
          class="auto-scroll-button"
          :variant="autoScrollEnabled ? 'success' : 'primary'"
          size="sm"
          icon="pixelarticons:chevron-down"
          icon-only
          :title="autoScrollEnabled ? $t('ui.log.autoScrollEnabled') : $t('ui.log.autoScrollDisabled')"
          @click="handleButtonClick"
          @dblclick="handleButtonDoubleClick"
        />
        <RetroButton
          class="log-clear"
          size="sm"
          variant="danger"
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
        <div class="log-entry-body">
          <details
            v-if="line.error || line.details"
            class="log-disclosure"
          >
            <summary class="log-summary">
              <span
                class="log-message"
                :class="'log-' + line.level"
              >{{ line.message }}</span>
              <span class="log-expand-button">{{ $t('ui.common.details') }}</span>
            </summary>
            <div class="log-subitems">
              <pre
                v-if="line.error"
                class="log-subitem-content log-subitem-content--error"
              >{{ line.error }}</pre>
              <pre
                v-if="line.details"
                class="log-subitem-content"
              >{{ line.details }}</pre>
            </div>
          </details>
          <span
            v-else
            class="log-message"
            :class="'log-' + line.level"
          >{{ line.message }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onUnmounted, ref, useTemplateRef, watch } from 'vue';

import { RetroButton } from '@/components/retro';
import type { BurnerLogEntry } from '@/types/burner-log';
import { resolveAutoScrollEnabled } from '@/utils/log-viewer';

const props = withDefaults(defineProps<{
  title?: string;
  logs: BurnerLogEntry[];
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
const autoScrollEnabled = ref(props.autoScroll);
const hasUserAutoScrollOverride = ref(false);

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
  isUserScrolling.value = false;
  scrollToBottom();
}

// 处理按钮双击事件
function handleButtonDoubleClick() {
  // 双击：切换持续自动下滚
  hasUserAutoScrollOverride.value = true;
  autoScrollEnabled.value = !autoScrollEnabled.value;

  // 如果启用了自动滚动，立即滚动到底部
  if (autoScrollEnabled.value) {
    scrollToBottom();
  }
}

// 智能检测是否需要启用自动滚动
function detectAutoScrollState() {
  autoScrollEnabled.value = resolveAutoScrollEnabled(
    autoScrollEnabled.value,
    props.logs.length,
    hasUserAutoScrollOverride.value,
    props.autoScroll,
  );
}

watch(() => props.autoScroll, (enabled) => {
  if (!hasUserAutoScrollOverride.value) {
    autoScrollEnabled.value = enabled;
  }
});

// 自动滚动到底部
watch(() => props.logs.length, async () => {
  // 检测是否需要调整自动滚动状态
  detectAutoScrollState();

  if (!autoScrollEnabled.value || isUserScrolling.value) {
    return;
  }

  await nextTick();
  await nextTick(); // 双重nextTick确保DOM完全更新

  scrollToBottom();
}, { flush: 'post' });

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
  width: auto;
  flex: 1 1 auto;
  max-width: none;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 320px;
  height: min(56vh, 520px);
  background: var(--retro-bg-surface);
  border: var(--retro-border-width) solid var(--retro-border);
  border-radius: 6px;
  padding: var(--space-3);
  box-shadow: var(--retro-shadow-card);
  box-sizing: border-box;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
  flex-shrink: 0;
  height: 32px;
  min-width: 0;
  gap: var(--space-2);
}

.log-header h2 {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  color: var(--retro-ink);
}

.log-header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.log-area-scroll {
  background-color: var(--retro-bg-surface);
  color: var(--retro-ink);
  border-radius: 4px;
  border: var(--retro-border-width) solid var(--retro-border);
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-3);
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  overflow-x: hidden;
  font-family: var(--retro-font-mono);
  font-size: var(--font-size-xs);
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
  min-width: 0;
  max-width: 100%;
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

.log-entry-body {
  flex: 1 1 0;
  min-width: 0;
}

.log-message {
  flex: 1 1 auto;
  min-width: 0;
  color: var(--retro-ink);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
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

.log-disclosure {
  display: block;
  width: 100%;
  min-width: 0;
}

.log-summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  min-width: 0;
  max-width: 100%;
  cursor: pointer;
  list-style: none;
}

.log-summary::-webkit-details-marker {
  display: none;
}

.log-expand-button {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  height: calc(var(--font-size-sm) * var(--line-height-relaxed) - 2px);
  margin: 1px 0;
  padding: 0 var(--space-2);
  box-sizing: border-box;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  line-height: 1;
}

.log-disclosure[open] .log-expand-button {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.log-subitems {
  margin: var(--space-1) 0 var(--space-3);
  display: grid;
  gap: var(--space-2);
  min-width: 0;
  max-width: 100%;
}

.log-subitem-content {
  margin: 0;
  padding: var(--space-2);
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  background: color-mix(in srgb, var(--color-bg-tertiary) 85%, transparent);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: var(--font-size-xs);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.log-subitem-content--error {
  color: var(--color-error);
  border-color: color-mix(in srgb, var(--color-error) 35%, var(--color-border));
}

@container burner (min-width: 860px) {
  .log-section {
    height: 100%;
    min-height: 0;
  }
}

@container burner (max-width: 859px) {
  .log-section {
    width: 100%;
    max-width: 100%;
    flex: 1 1 auto;
    height: min(56vh, 520px);
  }
}

@container burner (max-width: 719px) {
  .log-section {
    height: min(52vh, 420px);
  }
}
</style>
