<template>
  <div
    class="theme-switcher"
    :class="{ 'is-inline': inline }"
    role="group"
    :aria-label="$t('ui.theme.label')"
  >
    <button
      v-for="theme in themes"
      :key="theme.id"
      type="button"
      class="theme-swatch-btn"
      :class="{ 'is-active': currentTheme === theme.id }"
      :title="`${$t(theme.labelKey)} (${theme.swatch})`"
      :aria-label="`${$t(theme.labelKey)} (${theme.swatch})`"
      :aria-pressed="currentTheme === theme.id"
      @click="setTheme(theme.id)"
    >
      <span
        class="theme-swatch"
        :style="{ backgroundColor: theme.swatch }"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import { useTheme } from '@/composables/useTheme';

withDefaults(defineProps<{
  inline?: boolean;
}>(), {
  inline: false,
});

const { currentTheme, themes, setTheme } = useTheme();
</script>

<style scoped>
.theme-switcher {
  position: fixed;
  top: var(--space-5);
  right: var(--space-5);
  z-index: 1000;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 5px;
  box-sizing: border-box;
  border: 1.5px solid var(--retro-border);
  border-radius: 4px;
  background: var(--retro-bg-surface);
  box-shadow: var(--retro-shadow-btn);
}

.theme-switcher.is-inline {
  position: static;
  top: auto;
  right: auto;
  z-index: auto;
}

.theme-swatch-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 1.5px solid transparent;
  border-radius: 3px;
  background: transparent;
  cursor: pointer;
  transition: transform 0.1s ease, border-color 0.12s ease, background-color 0.12s ease;
}

.theme-swatch-btn:hover {
  background: var(--retro-bg-tint);
  transform: translateY(-1px);
}

.theme-swatch-btn.is-active {
  border-color: var(--retro-border);
  background: var(--retro-bg-tint);
}

.theme-swatch-btn:focus-visible {
  outline: 2px solid var(--retro-primary-bg);
  outline-offset: 1px;
}

.theme-swatch {
  display: block;
  width: 12px;
  height: 12px;
  border-radius: 2px;
  border: 1px solid var(--retro-border);
  box-sizing: border-box;
}
</style>
