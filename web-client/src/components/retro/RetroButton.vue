<template>
  <button
    :type="type"
    class="retro-btn"
    :class="[
      `variant-${variant}`,
      `size-${size}`,
      {
        'is-icon-only': iconOnly,
        'is-active': active,
        'is-block': block,
      },
    ]"
    :disabled="disabled"
    :title="title"
    @click="$emit('click', $event)"
  >
    <RetroIcon
      v-if="icon"
      :icon="icon"
      class="retro-btn-icon"
    />
    <span
      v-if="$slots.default || text"
      class="retro-btn-text"
    >
      <slot>{{ text }}</slot>
    </span>
  </button>
</template>

<script setup lang="ts">
import RetroIcon from './RetroIcon.vue';

interface Props {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning' | 'success';
  size?: 'xs' | 'sm' | 'md';
  icon?: string;
  text?: string;
  title?: string;
  iconOnly?: boolean;
  active?: boolean;
  disabled?: boolean;
  block?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

withDefaults(defineProps<Props>(), {
  variant: 'secondary',
  size: 'md',
  icon: undefined,
  text: undefined,
  title: undefined,
  iconOnly: false,
  active: false,
  disabled: false,
  block: false,
  type: 'button',
});

defineEmits<{
  click: [event: MouseEvent];
}>();
</script>

<style scoped>
.retro-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  white-space: nowrap;
  flex-shrink: 0;
  border: 1.5px solid var(--retro-border);
  border-radius: 4px;
  font-weight: var(--font-weight-semibold);
  line-height: 1.5;
  cursor: pointer;
  box-shadow: var(--retro-shadow-btn);
  box-sizing: border-box;
  transition: transform 0.1s ease, box-shadow 0.1s ease, background-color 0.12s ease, color 0.12s ease;
}

.retro-btn.is-block {
  width: 100%;
}

.retro-btn.size-xs {
  padding: 3px 8px;
  min-height: 24px;
  font-family: var(--retro-font-micro);
  font-size: 10px;
  line-height: 1.2;
}

.retro-btn.size-sm {
  padding: 5px 12px;
  min-height: 32px;
  font-size: var(--font-size-sm);
}

.retro-btn.size-md {
  padding: 8px 16px;
  min-height: 38px;
  font-size: var(--font-size-sm);
}

.retro-btn.is-icon-only {
  width: 26px;
  height: 26px;
  min-height: 26px;
  padding: 0;
  border-radius: 3px;
  font-size: var(--font-size-sm);
}

.retro-btn.is-icon-only.size-sm {
  width: 32px;
  height: 32px;
  min-height: 32px;
}

.retro-btn.variant-primary {
  background: var(--retro-primary-bg);
  color: var(--retro-primary-fg);
}

.retro-btn.variant-secondary {
  background: var(--retro-bg-tint);
  color: var(--retro-ink);
}

.retro-btn.variant-secondary:hover:not(:disabled) {
  background: var(--retro-bg-tint-hover);
}

.retro-btn.variant-ghost {
  background: var(--retro-bg-surface);
  color: var(--retro-ink);
}

.retro-btn.variant-ghost:hover:not(:disabled) {
  background: var(--retro-bg-tint);
}

.retro-btn.variant-danger {
  background: var(--retro-bg-surface);
  color: var(--retro-danger-fg);
}

.retro-btn.variant-danger:hover:not(:disabled) {
  background: var(--retro-danger-bg);
}

.retro-btn.variant-warning {
  background: var(--retro-warning-bg);
  color: var(--retro-ink);
}

.retro-btn.variant-success {
  background: var(--retro-success-bg);
  color: var(--retro-ink);
}

.retro-btn.is-active {
  background: var(--retro-primary-bg);
  color: var(--retro-primary-fg);
}

.retro-btn:hover:not(:disabled) {
  transform: translate(-1px, 1px);
  box-shadow: var(--retro-shadow-btn-hover);
}

.retro-btn:active:not(:disabled) {
  transform: translate(-2px, 2px);
  box-shadow: none;
}

.retro-btn:disabled {
  opacity: 0.48;
  cursor: not-allowed;
  box-shadow: none;
}

.retro-btn-icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.retro-btn--icon-sm .retro-btn-icon {
  width: 12px;
  height: 12px;
}

.retro-btn--icon-md .retro-btn-icon {
  width: 24px;
  height: 24px;
}
</style>
