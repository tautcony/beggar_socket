<template>
  <div
    class="retro-dropzone"
    :class="{ 'is-compact': compact, 'is-dragging': isDragging }"
    @click="triggerInput"
    @dragover.prevent="isDragging = true"
    @dragleave.prevent="isDragging = false"
    @drop.prevent="handleDrop"
  >
    <input
      ref="fileInput"
      type="file"
      :accept="accept"
      :multiple="multiple"
      style="display: none"
      @change="handleChange"
    >
    <RetroIcon
      v-if="icon"
      :icon="icon"
      class="retro-dropzone-icon"
    />
    <span class="retro-dropzone-title">{{ title }}</span>
    <span
      v-if="hint"
      class="retro-dropzone-hint"
    >
      {{ hint }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import RetroIcon from './RetroIcon.vue';

interface Props {
  icon?: string;
  title: string;
  hint?: string;
  accept?: string;
  multiple?: boolean;
  compact?: boolean;
}

withDefaults(defineProps<Props>(), {
  icon: undefined,
  hint: undefined,
  accept: undefined,
  multiple: false,
  compact: false,
});

const emit = defineEmits<{
  'files-selected': [files: File[]];
}>();

const fileInput = ref<HTMLInputElement>();
const isDragging = ref(false);

function triggerInput() {
  fileInput.value?.click();
}

function handleChange(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    emit('files-selected', Array.from(input.files));
    input.value = '';
  }
}

function handleDrop(e: DragEvent) {
  isDragging.value = false;
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    emit('files-selected', Array.from(e.dataTransfer.files));
  }
}
</script>

<style scoped>
.retro-dropzone {
  flex: 1;
  min-height: 110px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: var(--space-3);
  border: 1.5px dashed var(--retro-border-dashed);
  border-radius: 6px;
  background: var(--retro-bg-surface);
  color: var(--retro-ink-muted);
  cursor: pointer;
  box-sizing: border-box;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.retro-dropzone.is-compact {
  min-height: 90px;
}

.retro-dropzone:hover,
.retro-dropzone.is-dragging {
  border-color: var(--retro-border);
  background: var(--retro-bg-elevated);
}

.retro-dropzone-icon {
  font-size: 22px;
  color: var(--retro-ink);
}

.retro-dropzone-title {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--retro-ink);
}

.retro-dropzone-hint {
  font-family: var(--retro-font-micro);
  font-size: 10px;
  color: var(--retro-ink-subtle);
}
</style>
