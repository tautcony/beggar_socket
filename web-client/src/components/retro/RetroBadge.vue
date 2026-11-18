<template>
  <span
    class="retro-badge"
    :class="[`variant-${variant}`, { 'is-mono': mono, 'is-pill': pill }]"
  >
    <slot>{{ text }}</slot>
  </span>
</template>

<script setup lang="ts">
interface Props {
  variant?: 'default' | 'info' | 'success' | 'warning' | 'danger';
  text?: string | number;
  mono?: boolean;
  pill?: boolean;
}

withDefaults(defineProps<Props>(), {
  variant: 'default',
  text: undefined,
  mono: true,
  pill: false,
});
</script>

<style scoped>
.retro-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border: 1.5px solid var(--retro-border);
  border-radius: 4px;
  background: var(--retro-bg-surface);
  color: var(--retro-ink);
  font-family: var(--app-font-sans);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  line-height: 1.4;
}

.retro-badge.is-mono {
  font-family: var(--retro-font-mono);
  font-size: var(--font-size-xs);
  line-height: 1.5;
}

.retro-badge.is-pill {
  border-radius: 999px;
}

.retro-badge.variant-info {
  background: var(--retro-bg-tint);
}

.retro-badge.variant-success {
  background: var(--retro-success-bg);
}

.retro-badge.variant-warning {
  background: var(--retro-warning-bg);
}

.retro-badge.variant-danger {
  background: var(--retro-danger-bg);
  color: var(--retro-danger-fg);
}
</style>
