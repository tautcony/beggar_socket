<template>
  <component
    :is="tag"
    class="retro-list-item"
    :class="{
      'is-active': active,
      'is-invalid': invalid,
      'is-clickable': clickable,
    }"
    :type="tag === 'button' ? 'button' : undefined"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  active?: boolean;
  invalid?: boolean;
  clickable?: boolean;
  tag?: 'button' | 'a' | 'div';
}>(), {
  active: false,
  invalid: false,
  clickable: true,
  tag: 'button',
});
</script>

<style scoped>
.retro-list-item {
  display: flex;
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border: var(--retro-border-width) solid var(--retro-border-subtle);
  border-radius: 6px;
  background: var(--retro-bg-surface);
  color: var(--retro-ink);
  box-sizing: border-box;
  transition: transform 0.1s ease, box-shadow 0.1s ease, border-color 0.12s ease, background-color 0.12s ease;
}

.retro-list-item.is-clickable {
  cursor: pointer;
}

.retro-list-item.is-clickable:hover {
  border-color: var(--retro-border);
  background: var(--retro-bg-elevated);
  transform: translate(-1px, 1px);
  box-shadow: var(--retro-shadow-btn-hover);
}

.retro-list-item.is-active {
  border-color: var(--retro-border);
  background: var(--retro-bg-tint);
  box-shadow: var(--retro-shadow-btn);
}

.retro-list-item.is-invalid {
  border-color: var(--retro-danger-fg);
  background: var(--retro-danger-bg);
}
</style>
