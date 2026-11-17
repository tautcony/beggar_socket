<template>
  <div class="retro-progress">
    <div
      v-if="label || showPercent"
      class="retro-progress-meta"
    >
      <span
        v-if="label"
        class="retro-progress-label"
      >
        {{ label }}
      </span>
      <span
        v-if="showPercent"
        class="retro-progress-percent"
      >
        {{ clampedPercent.toFixed(0) }}%
      </span>
    </div>
    <div
      class="retro-progress-track"
      role="progressbar"
      :aria-valuenow="clampedPercent"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div
        class="retro-progress-fill"
        :class="`variant-${variant}`"
        :style="{ width: `${clampedPercent}%` }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  value: number;
  max?: number;
  label?: string;
  showPercent?: boolean;
  variant?: 'primary' | 'success' | 'warning' | 'danger';
}

const props = withDefaults(defineProps<Props>(), {
  max: 100,
  label: undefined,
  showPercent: true,
  variant: 'primary',
});

const clampedPercent = computed(() => {
  if (props.max <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, (props.value / props.max) * 100));
});
</script>

<style scoped>
.retro-progress {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.retro-progress-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-family: var(--retro-font-micro);
  font-size: 10px;
  color: var(--retro-ink-muted);
}

.retro-progress-percent {
  font-weight: var(--font-weight-bold);
  color: var(--retro-ink);
}

.retro-progress-track {
  width: 100%;
  height: 10px;
  border: 1.5px solid var(--retro-border);
  border-radius: 4px;
  background: var(--retro-bg-elevated);
  overflow: hidden;
  box-sizing: border-box;
}

.retro-progress-fill {
  height: 100%;
  background: var(--retro-primary-bg);
  transition: width 0.2s ease;
}

.retro-progress-fill.variant-success {
  background: #2b8a3e;
}

.retro-progress-fill.variant-warning {
  background: #e67700;
}

.retro-progress-fill.variant-danger {
  background: var(--retro-danger-fg);
}
</style>
