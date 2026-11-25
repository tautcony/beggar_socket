<template>
  <div
    class="retro-select-wrap"
    :class="[`size-${size}`, { 'is-disabled': disabled, 'is-full-width': fullWidth, 'has-prefix': Boolean(prefixIcon) }]"
  >
    <RetroIcon
      v-if="prefixIcon"
      :icon="prefixIcon"
      class="retro-select-prefix"
    />
    <select
      v-bind="$attrs"
      v-model="selectedValue"
      class="retro-select-control"
      :disabled="disabled"
      @change="$emit('change', $event)"
    >
      <slot />
    </select>
    <RetroIcon
      icon="pixelarticons:chevron-down"
      class="retro-select-arrow"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import RetroIcon from './RetroIcon.vue';

defineOptions({
  inheritAttrs: false,
});

interface Props {
  modelValue?: string | number;
  value?: string | number;
  disabled?: boolean;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  prefixIcon?: string;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  value: undefined,
  disabled: false,
  size: 'sm',
  fullWidth: false,
  prefixIcon: undefined,
});

const emit = defineEmits<{
  'update:modelValue': [value: string | number | undefined];
  change: [event: Event];
}>();

const selectedValue = computed<string | number | undefined>({
  get: () => props.modelValue ?? props.value,
  set: (val) => {
    emit('update:modelValue', val);
  },
});
</script>

<style scoped>
.retro-select-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-width: 80px;
}

.retro-select-wrap.is-full-width {
  width: 100%;
}

.retro-select-control {
  width: 100%;
  appearance: none;
  -webkit-appearance: none;
  box-sizing: border-box;
  border: var(--retro-border-width) solid var(--retro-border);
  border-radius: 4px;
  background: var(--retro-bg-surface);
  color: var(--retro-ink);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  box-shadow: var(--retro-shadow-btn);
  cursor: pointer;
  transition: box-shadow 0.12s ease, background-color 0.12s ease;
  white-space: nowrap;
}

.retro-select-wrap.size-sm .retro-select-control {
  height: 28px;
  padding: 0 28px 0 10px;
}

.retro-select-wrap.size-md .retro-select-control {
  height: 34px;
  padding: 0 30px 0 12px;
}

.retro-select-wrap.has-prefix.size-sm .retro-select-control {
  padding-left: 30px;
}

.retro-select-wrap.has-prefix.size-md .retro-select-control {
  padding-left: 34px;
}

.retro-select-prefix {
  position: absolute;
  left: 9px;
  top: 0;
  bottom: 0;
  margin-block: auto;
  font-size: var(--font-size-xs);
  color: var(--retro-ink);
  pointer-events: none;
  z-index: 1;
}

.retro-select-control:hover:not(:disabled) {
  background: var(--retro-bg-tint);
  box-shadow: var(--retro-shadow-btn-hover);
}

.retro-select-control:focus {
  outline: none;
}

.retro-select-control:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

.retro-select-control option {
  background-color: var(--retro-bg-surface);
  color: var(--retro-ink);
}

.retro-select-arrow {
  position: absolute;
  right: 8px;
  top: 0;
  bottom: 0;
  margin-block: auto;
  font-size: var(--font-size-xs);
  color: var(--retro-ink-muted);
  pointer-events: none;
  z-index: 1;
}

.retro-select-wrap.is-disabled .retro-select-arrow {
  opacity: 0.5;
}
</style>
