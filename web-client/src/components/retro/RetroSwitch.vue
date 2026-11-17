<template>
  <label
    class="retro-switch"
    :class="{ 'is-disabled': disabled }"
    :title="tooltip"
  >
    <input
      :checked="modelValue"
      type="checkbox"
      :disabled="disabled"
      class="retro-switch-input"
      @change="handleChange"
    >
    <span class="retro-switch-track">
      <span class="retro-switch-thumb" />
    </span>
    <span
      v-if="label || $slots.default"
      class="retro-switch-label"
    >
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>

<script setup lang="ts">
interface Props {
  modelValue: boolean;
  label?: string;
  tooltip?: string;
  disabled?: boolean;
}

withDefaults(defineProps<Props>(), {
  label: undefined,
  tooltip: undefined,
  disabled: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

function handleChange(e: Event) {
  const target = e.target as HTMLInputElement;
  emit('update:modelValue', target.checked);
}
</script>

<style scoped>
.retro-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--retro-ink);
}

.retro-switch.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.retro-switch-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.retro-switch-track {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 40px;
  height: 22px;
  padding: 2px;
  border: 1.5px solid var(--retro-border);
  border-radius: 4px;
  background: var(--retro-bg-elevated);
  box-shadow: var(--retro-shadow-btn);
  box-sizing: border-box;
  transition: background-color 0.14s ease;
}

.retro-switch-thumb {
  width: 14px;
  height: 14px;
  border: 1.5px solid var(--retro-border);
  border-radius: 2px;
  background: var(--retro-bg-surface);
  box-sizing: border-box;
  transition: transform 0.14s ease, background-color 0.14s ease;
}

.retro-switch-input:checked + .retro-switch-track {
  background: var(--retro-bg-tint);
}

.retro-switch-input:checked + .retro-switch-track .retro-switch-thumb {
  transform: translateX(18px);
  background: var(--retro-primary-bg);
}

.retro-switch-label {
  color: var(--retro-ink);
}
</style>
