<template>
  <div
    :class="['floating-link', customClass]"
    :style="containerStyle"
  >
    <component
      :is="href ? 'a' : 'button'"
      class="floating-button"
      :href="href"
      :target="href ? '_blank' : undefined"
      :rel="href ? 'noopener noreferrer' : undefined"
      :title="title"
      :style="buttonStyle"
      v-on="$attrs"
      @click="$emit('click', $event)"
    >
      <span class="floating-icon">
        <slot name="icon">{{ icon }}</slot>
      </span>
      <span class="floating-text">
        <slot>{{ text }}</slot>
      </span>
    </component>
  </div>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue';

interface StyleOverrides {
  container?: Record<string, string | number>;
  button?: Record<string, string | number>;
}

const props = defineProps<{
  icon?: string;
  text?: string;
  color?: string;
  href?: string;
  title?: string;
  bottom?: string | number;
  right?: string | number;
  customClass?: string;
  styleOverrides?: StyleOverrides;
}>();

const emits = defineEmits<{
  click: [event: MouseEvent];
}>();

const containerStyle = computed<Record<string, string | number>>(() => {
  const baseStyle: Record<string, string | number> = {
    position: 'fixed',
    bottom: typeof props.bottom === 'number' ? `${props.bottom}px` : (props.bottom ?? '20px'),
    right: typeof props.right === 'number' ? `${props.right}px` : (props.right ?? '20px'),
    zIndex: 1000,
  };

  return {
    ...baseStyle,
    ...(props.styleOverrides?.container ?? {}),
  };
});

const buttonStyle = computed<Record<string, string | number>>(() => ({
  background: props.color ?? '#1976d2',
  ...(props.styleOverrides?.button ?? {}),
}));
</script>

<style scoped>
.floating-button {
  display: flex;
  align-items: center;
  background: var(--color-primary);
  color: #ffffff;
  padding: var(--space-2) var(--space-3);
  border-radius: 25px;
  border: none;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  box-shadow: var(--shadow-md);
  transition: all 0.3s ease;
  transform: translateX(calc(100% - 40px));
  overflow: hidden;
  white-space: nowrap;
  cursor: pointer;
  text-decoration: none;
}

.floating-button:hover {
  background: var(--color-primary-hover);
  transform: translateX(0);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
}

.floating-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-base);
}

.floating-text {
  margin-left: var(--space-2);
  opacity: 0;
  transition: opacity 0.3s ease 0.1s;
}

.floating-button:hover .floating-text {
  opacity: 1;
}
</style>
