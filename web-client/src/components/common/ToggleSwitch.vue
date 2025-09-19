<template>
  <label
    class="toggle-container"
    :title="tooltip"
  >
    <input
      :checked="modelValue"
      type="checkbox"
      :disabled="disabled"
      class="toggle-input"
      @change="handleChange"
    >
    <span class="toggle-slider" />
    <span
      v-if="label"
      class="toggle-label"
    >{{ label }}</span>
  </label>
</template>

<script setup lang="ts">
interface Props {
  modelValue: boolean;
  label?: string;
  tooltip?: string;
  disabled?: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

function handleChange(event: Event) {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', target.checked);
}
</script>

<style scoped>
.toggle-container {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  user-select: none;
  font-size: var(--font-size-sm);
}

.toggle-container[title] {
  cursor: help;
}

.toggle-input {
  display: none;
}

.toggle-slider {
  position: relative;
  width: 44px;
  height: 24px;
  background-color: var(--color-border);
  border-radius: var(--radius-2xl);
  transition: background-color 0.3s ease;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  top: var(--space-1);
  left: var(--space-1);
  width: 20px;
  height: 20px;
  background-color: white;
  border-radius: var(--radius-full);
  transition: transform 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle-input:checked + .toggle-slider {
  background-color: var(--color-primary);
}

.toggle-input:checked + .toggle-slider::before {
  transform: translateX(20px);
}

.toggle-input:disabled + .toggle-slider {
  background-color: var(--color-border-light);
  cursor: not-allowed;
}

.toggle-input:disabled + .toggle-slider::before {
  background-color: var(--color-bg-secondary);
}

.toggle-container:has(.toggle-input:disabled) {
  cursor: not-allowed;
  opacity: 0.6;
}

.toggle-label {
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
}
</style>
