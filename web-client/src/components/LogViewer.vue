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
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  title: {
    type: String,
    default: '日志'
  },
  logs: {
    type: Array,
    required: true
  },
  maxHeight: {
    type: String,
    default: '350px'
  }
})

const emit = defineEmits(['clear-logs'])

const logBox = ref(null)

function clearLog() {
  emit('clear-logs')
}

// 自动滚动到底部
watch(() => props.logs, async () => {
  await nextTick()
  if (logBox.value) {
    logBox.value.scrollTop = logBox.value.scrollHeight
  }
})
</script>

<style scoped>
.log-section {
  width: 350px;
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
