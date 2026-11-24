<template>
  <div
    class="retro-segmented"
    role="tablist"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="tab"
      :aria-selected="modelValue === option.value"
      class="retro-segment-btn"
      :class="{ 'is-active': modelValue === option.value }"
      :disabled="option.disabled"
      @click="$emit('update:modelValue', option.value)"
    >
      <RetroIcon
        v-if="option.icon"
        :icon="option.icon"
        class="retro-segment-icon"
      />
      <span>{{ option.label }}</span>
      <span
        v-if="option.badge"
        class="retro-segment-badge"
      >
        {{ option.badge }}
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import RetroIcon from './RetroIcon.vue';

export interface RetroSegmentOption {
  value: string;
  label: string;
  icon?: string;
  badge?: string;
  disabled?: boolean;
}

defineProps<{
  modelValue: string;
  options: readonly RetroSegmentOption[];
}>();

defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<style scoped>
.retro-segmented {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px;
  border: 1.5px solid var(--retro-border);
  border-radius: 6px;
  background: var(--retro-bg-elevated);
  box-shadow: var(--retro-shadow-btn);
  box-sizing: border-box;
}

.retro-segment-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 14px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--retro-ink-muted);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease;
}

.retro-segment-btn:hover:not(:disabled):not(.is-active) {
  color: var(--retro-ink);
  background: var(--retro-bg-tint);
}

.retro-segment-btn.is-active {
  background: var(--retro-primary-bg);
  color: var(--retro-primary-fg);
}

.retro-segment-btn:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.retro-segment-icon {
  font-size: var(--font-size-sm);
  flex-shrink: 0;
}

.retro-segment-badge {
  font-family: var(--retro-font-micro);
  font-size: var(--font-size-micro);
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(128, 128, 128, 0.22);
  letter-spacing: var(--letter-spacing-wide);
}
</style>
