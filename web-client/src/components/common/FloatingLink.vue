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
  background: #1976d2;
  color: white;
  padding: 8px 12px;
  border-radius: 25px;
  border: none;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
  transform: translateX(calc(100% - 40px));
  overflow: hidden;
  white-space: nowrap;
  cursor: pointer;
  text-decoration: none;
}
.floating-button:hover {
  background: #1565c0;
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
  font-size: 16px;
}
.floating-text {
  margin-left: 8px;
  opacity: 0;
  transition: opacity 0.3s ease 0.1s;
}
.floating-button:hover .floating-text {
  opacity: 1;
}
@media (max-width: 768px) {
  .floating-button {
    padding: 6px 10px;
    font-size: 12px;
  }
  .floating-icon {
    width: 18px;
    height: 18px;
    font-size: 14px;
  }
}
</style>
