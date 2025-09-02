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
  gap: 8px;
  cursor: pointer;
  user-select: none;
  font-size: 0.95rem;
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
  background-color: #ccc;
  border-radius: 12px;
  transition: background-color 0.3s ease;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background-color: white;
  border-radius: 50%;
  transition: transform 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle-input:checked + .toggle-slider {
  background-color: #007bff;
}

.toggle-input:checked + .toggle-slider::before {
  transform: translateX(20px);
}

.toggle-input:disabled + .toggle-slider {
  background-color: #e0e0e0;
  cursor: not-allowed;
}

.toggle-input:disabled + .toggle-slider::before {
  background-color: #f5f5f5;
}

.toggle-container:has(.toggle-input:disabled) {
  cursor: not-allowed;
  opacity: 0.6;
}

.toggle-label {
  color: #333;
  font-weight: 500;
}
</style>
