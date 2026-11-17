<template>
  <section
    class="retro-card"
    :class="[`padding-${padding}`, { 'is-fill': fill }]"
  >
    <header
      v-if="hasHeader"
      class="retro-card-header"
    >
      <div class="retro-card-title-group">
        <slot name="header-left">
          <h3
            v-if="title"
            class="retro-card-title"
          >
            {{ title }}
          </h3>
        </slot>
        <span
          v-if="badge !== undefined && badge !== ''"
          class="retro-count-pill"
        >
          {{ badge }}
        </span>
      </div>
      <div
        v-if="$slots['header-right']"
        class="retro-card-header-right"
      >
        <slot name="header-right" />
      </div>
    </header>

    <div
      class="retro-card-body"
      :class="{ 'is-fill': fill }"
    >
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue';

interface Props {
  title?: string;
  badge?: string | number;
  padding?: 'sm' | 'md';
  fill?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: undefined,
  badge: undefined,
  padding: 'sm',
  fill: false,
});

const slots = useSlots();
const hasHeader = computed(
  () =>
    Boolean(props.title)
    || (props.badge !== undefined && props.badge !== '')
    || Boolean(slots['header-left'])
    || Boolean(slots['header-right']),
);
</script>

<style scoped>
.retro-card {
  display: flex;
  flex-direction: column;
  background: var(--retro-bg-surface);
  border: 1.5px solid var(--retro-border);
  border-radius: 6px;
  box-shadow: var(--retro-shadow-card);
  color: var(--retro-ink);
  box-sizing: border-box;
}

.retro-card.padding-sm {
  padding: var(--space-3);
}

.retro-card.padding-md {
  padding: var(--space-4);
}

.retro-card.is-fill {
  height: 100%;
  min-height: 0;
}

.retro-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  min-height: 32px;
  margin-bottom: var(--space-3);
  flex-shrink: 0;
}

.retro-card-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.retro-card-title {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  color: var(--retro-ink);
}

.retro-count-pill {
  font-family: var(--retro-font-micro);
  font-size: 10px;
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px solid var(--retro-border-subtle);
  background: var(--retro-bg-elevated);
  color: var(--retro-ink-muted);
}

.retro-card-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  max-width: 100%;
  flex-shrink: 0;
}

.retro-card-body {
  display: flex;
  flex-direction: column;
}

.retro-card-body.is-fill {
  flex: 1;
  min-height: 0;
}
</style>
