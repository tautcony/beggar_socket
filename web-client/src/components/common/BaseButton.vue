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

<style lang="scss" scoped>
@use '@/styles/variables/colors' as color-vars;
@use '@/styles/variables/spacing' as spacing-vars;
@use '@/styles/variables/typography' as typography-vars;
@use '@/styles/variables/radius' as radius-vars;
@use '@/styles/mixins' as mixins;

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  line-height: 1;
  border: none;
  border-radius: radius-vars.$radius-button;
  font-family: inherit;
  font-weight: typography-vars.$font-weight-medium;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: color-vars.$shadow-sm;
  position: relative;
  overflow: hidden;

  // 防止文字换行
  white-space: nowrap;
  text-overflow: ellipsis;

  /* 有icon时的样式 */
  &.button-with-icon {
    gap: spacing-vars.$space-2;
  }

  /* 没有icon时的样式 */
  &.button-without-icon {
    gap: 0;
  }
}

/* 尺寸变体 */
.button-sm {
  padding: spacing-vars.$space-1 spacing-vars.$space-3;
  font-size: typography-vars.$font-size-sm;
  min-height: 32px;
  height: 32px;
}

.button-md {
  padding: spacing-vars.$space-2 spacing-vars.$space-4;
  font-size: typography-vars.$font-size-base;
  min-height: 40px;
  height: 40px;
}

.button-lg {
  padding: spacing-vars.$space-3 spacing-vars.$space-6;
  font-size: typography-vars.$font-size-lg;
  font-weight: typography-vars.$font-weight-semibold;
  min-height: 48px;
  height: 48px;
}

/* 颜色变体 */
@mixin button-hover-effect {
  &:hover:not(.button-disabled) {
    box-shadow: color-vars.$shadow-md;
    transform: translateY(-1px);
  }

  &:active:not(.button-disabled) {
    transform: translateY(1px);
  }
}

.button-primary {
  @include mixins.button-variant(white, color-vars.$color-primary);
  @include button-hover-effect;
}

.button-secondary {
  background: color-vars.$color-secondary;
  color: white;
  @include button-hover-effect;

  &:hover:not(.button-disabled) {
    background: #545b62;
    box-shadow: color-vars.$shadow-md;
    transform: translateY(-1px);
  }
}

.button-success {
  @include mixins.button-variant(white, color-vars.$color-success);
  @include button-hover-effect;
}

.button-warning {
  background: color-vars.$color-warning;
  color: color-vars.$color-text;
  @include button-hover-effect;

  &:hover:not(.button-disabled) {
    background: #e0a800;
    box-shadow: color-vars.$shadow-md;
    transform: translateY(-1px);
  }
}

.button-error {
  @include mixins.button-variant(white, color-vars.$color-error);
  @include button-hover-effect;
}

.button-debug {
  background: color-vars.$color-success;
  color: white;
  border: 1px solid color-vars.$color-success;

  &:hover:not(.button-disabled) {
    background: color-vars.$color-success-hover;
    border-color: color-vars.$color-success-hover;
    box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);
    transform: translateY(-1px);
  }

  &:active:not(.button-disabled) {
    transform: translateY(1px);
  }

  &.secondary {
    background: color-vars.$color-error;
    border-color: color-vars.$color-error;

    &:hover:not(.button-disabled) {
      background: color-vars.$color-error-hover;
      border-color: color-vars.$color-error-hover;
      box-shadow: 0 2px 8px rgba(220, 53, 69, 0.3);
    }
  }
}

/* 禁用状态 */
.button-disabled {
  background-color: color-vars.$color-border;
  color: color-vars.$color-text-secondary;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;

  &:hover {
    background-color: color-vars.$color-border;
    box-shadow: none;
    transform: none;
  }
}

/* 加载状态 */
.button-loading {
  position: relative;

  &::after {
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

  .button-icon,
  slot {
    opacity: 0;
  }
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
@include mixins.respond-to(md) {
  .button {
    min-height: auto;
  }

  .button-sm {
    padding: spacing-vars.$space-1 spacing-vars.$space-2;
    font-size: typography-vars.$font-size-xs;
  }

  .button-md {
    padding: spacing-vars.$space-2 spacing-vars.$space-3;
  }

  .button-lg {
    padding: spacing-vars.$space-2 spacing-vars.$space-4;
    font-size: typography-vars.$font-size-base;
  }
}
</style>
