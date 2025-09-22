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

<style lang="scss" scoped>
@use '@/styles/variables/colors' as color-vars;
@use '@/styles/variables/spacing' as spacing-vars;
@use '@/styles/variables/typography' as typography-vars;
@use '@/styles/variables/radius' as radius-vars;
@use '@/styles/mixins' as mixins;

.toggle-container {
  display: flex;
  align-items: center;
  gap: spacing-vars.$space-2;
  cursor: pointer;
  user-select: none;
  font-size: typography-vars.$font-size-sm;

  &[title] {
    cursor: help;
  }

  &:has(.toggle-input:disabled) {
    cursor: not-allowed;
    opacity: 0.6;
  }
}

.toggle-input {
  display: none;

  &:checked + .toggle-slider {
    background-color: color-vars.$color-primary;

    &::before {
      transform: translateX(20px);
    }
  }

  &:disabled + .toggle-slider {
    background-color: color-vars.$color-border-light;
    cursor: not-allowed;

    &::before {
      background-color: color-vars.$color-bg-secondary;
    }
  }
}

.toggle-slider {
  position: relative;
  width: 44px;
  height: 24px;
  background-color: color-vars.$color-border;
  border-radius: radius-vars.$radius-2xl;
  transition: background-color 0.3s ease;

  &::before {
    content: '';
    position: absolute;
    top: spacing-vars.$space-1;
    left: spacing-vars.$space-1;
    width: 20px;
    height: 20px;
    background-color: white;
    border-radius: radius-vars.$radius-full;
    transition: transform 0.3s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
}

.toggle-label {
  color: color-vars.$color-text;
  font-weight: typography-vars.$font-weight-medium;
}
</style>
