<template>
  <button
    :class="buttonClasses"
    :disabled="disabled"
    :title="title"
    @click="handleClick"
  >
    <IonIcon
      v-if="icon"
      class="button-icon"
      :icon="icon"
      :style="iconStyle"
    />
    <slot>{{ text }}</slot>
  </button>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { computed } from 'vue';

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'debug';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: unknown;
  iconPosition?: 'left' | 'right';
  text?: string;
  title?: string;
}

const props = withDefaults(defineProps<ButtonProps>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  icon: undefined,
  iconPosition: 'left',
  text: '',
  title: '',
});

const emit = defineEmits<{
  click: [event: Event];
}>();

const buttonClasses = computed(() => {
  const classes = ['button'];

  // 变体类
  classes.push(`button-${props.variant}`);

  // 尺寸类
  classes.push(`button-${props.size}`);

  // Icon类
  if (props.icon) {
    classes.push('button-with-icon');
  } else {
    classes.push('button-without-icon');
  }

  // 状态类
  if (props.disabled || props.loading) {
    classes.push('button-disabled');
  }

  if (props.loading) {
    classes.push('button-loading');
  }

  return classes;
});

const iconStyle = computed(() => {
  const baseSize = {
    sm: '1em',
    md: '1.2em',
    lg: '1.4em',
  };

  return {
    'font-size': baseSize[props.size],
    'margin-right': props.iconPosition === 'left' && props.text ? '4px' : '0',
    'margin-left': props.iconPosition === 'right' && props.text ? '4px' : '0',
  };
});

function handleClick(event: Event) {
  if (!props.disabled && !props.loading) {
    emit('click', event);
  }
}
</script>

<style scoped>
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  line-height: 1;
  border: none;
  border-radius: var(--radius-button);
  font-family: var(--font-family-primary);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: var(--shadow-sm);
  position: relative;
  overflow: hidden;
}

/* 有icon时的样式 */
.button-with-icon {
  gap: var(--space-2);
}

/* 没有icon时的样式 */
.button-without-icon {
  gap: 0;
}

/* 尺寸变体 */
.button-sm {
  padding: var(--space-1) var(--space-3);
  font-size: var(--font-size-sm);
  min-height: 32px;
  height: 32px;
}

.button-md {
  padding: var(--space-2) var(--space-4);
  font-size: var(--font-size-base);
  min-height: 40px;
  height: 40px;
}

.button-lg {
  padding: var(--space-3) var(--space-6);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  min-height: 48px;
  height: 48px;
}

/* 颜色变体 */
.button-primary {
  background: var(--color-primary);
  color: white;
}

.button-primary:hover:not(.button-disabled) {
  background: var(--color-primary-hover);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.button-primary:active:not(.button-disabled) {
  transform: translateY(1px);
}

.button-secondary {
  background: var(--color-secondary);
  color: white;
}

.button-secondary:hover:not(.button-disabled) {
  background: #545b62;
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.button-secondary:active:not(.button-disabled) {
  transform: translateY(1px);
}

.button-success {
  background: var(--color-success);
  color: white;
}

.button-success:hover:not(.button-disabled) {
  background: var(--color-success-hover);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.button-success:active:not(.button-disabled) {
  transform: translateY(1px);
}

.button-warning {
  background: var(--color-warning);
  color: var(--color-text);
}

.button-warning:hover:not(.button-disabled) {
  background: #e0a800;
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.button-warning:active:not(.button-disabled) {
  transform: translateY(1px);
}

.button-error {
  background: var(--color-error);
  color: white;
}

.button-error:hover:not(.button-disabled) {
  background: var(--color-error-hover);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.button-error:active:not(.button-disabled) {
  transform: translateY(1px);
}

.button-debug {
  background: var(--color-success);
  color: white;
  border: 1px solid var(--color-success);
}

.button-debug:hover:not(.button-disabled) {
  background: var(--color-success-hover);
  border-color: var(--color-success-hover);
  box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);
  transform: translateY(-1px);
}

.button-debug:active:not(.button-disabled) {
  transform: translateY(1px);
}

.button-debug.secondary {
  background: var(--color-error);
  border-color: var(--color-error);
}

.button-debug.secondary:hover:not(.button-disabled) {
  background: var(--color-error-hover);
  border-color: var(--color-error-hover);
  box-shadow: 0 2px 8px rgba(220, 53, 69, 0.3);
}

/* 禁用状态 */
.button-disabled {
  background-color: var(--color-border);
  color: var(--color-text-secondary);
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

.button-disabled:hover {
  background-color: var(--color-border);
  box-shadow: none;
  transform: none;
}

/* 加载状态 */
.button-loading {
  position: relative;
}

.button-loading::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  margin: auto;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: button-loading-spinner 1s ease infinite;
}

.button-loading .button-icon,
.button-loading slot {
  opacity: 0;
}

@keyframes button-loading-spinner {
  from {
    transform: rotate(0turn);
  }
  to {
    transform: rotate(1turn);
  }
}

/* 图标样式 */
.button-icon {
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.button:hover:not(.button-disabled) .button-icon {
  transform: scale(1.1);
}

/* 响应式调整 */
@media (max-width: 768px) {
  .button {
    min-height: auto;
  }

  .button-sm {
    padding: var(--space-1) var(--space-2);
    font-size: var(--font-size-xs);
  }

  .button-md {
    padding: var(--space-2) var(--space-3);
  }

  .button-lg {
    padding: var(--space-2) var(--space-4);
    font-size: var(--font-size-base);
  }
}
</style>
