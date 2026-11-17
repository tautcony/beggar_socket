<template>
  <div
    v-if="isVisible"
    class="emulator-overlay"
    :class="{ 'is-covered': isCovered }"
    :style="{ '--wipe-theme-color': effectiveThemeColor }"
  >
    <!-- Stepped SVG Boustrophedon Snake Wipe Layer (0ms -> 500ms) -->
    <svg
      v-if="!isCovered"
      class="transition-wipe-svg"
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <path
        class="wipe-path wipe-path-top"
        d="M100 -5 V5 H0 V15 H100 V25 H0 V35 H100 V45 H0 V50 H50"
        stroke-width="10.2"
        stroke-linecap="square"
        stroke-linejoin="miter"
        pathLength="1"
        stroke-dasharray="1"
        :stroke="effectiveThemeColor"
        @animationend="handleAnimationEnd"
      />
      <path
        class="wipe-path wipe-path-bottom"
        d="M100 -5 V5 H0 V15 H100 V25 H0 V35 H100 V45 H0 V50 H50"
        transform="rotate(180 50 50)"
        stroke-width="10.2"
        stroke-linecap="square"
        stroke-linejoin="miter"
        pathLength="1"
        stroke-dasharray="1"
        :stroke="effectiveThemeColor"
      />
    </svg>

    <!-- Main Emulator Container (fades in 380ms once covered) -->
    <div
      class="emulator-container"
      :class="{ 'is-revealed': isCovered }"
    >
      <slot
        :is-covered="isCovered"
        :covered="isCovered"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue';

import { useEmulatorTransition } from '@/components/emulator/useEmulatorTransition';
import { useTheme } from '@/composables/useTheme';

const props = defineProps<{
  isVisible: boolean;
  themeColor?: string;
}>();

const { currentTheme, themes } = useTheme();

const effectiveThemeColor = computed(() => {
  if (props.themeColor) {
    return props.themeColor;
  }
  return themes.find((item) => item.id === currentTheme.value)?.swatch ?? '#BFA9E2';
});

const emit = defineEmits<{
  covered: [isCovered: boolean];
}>();

const isVisibleRef = toRef(props, 'isVisible');

const { isCovered, handleAnimationEnd } = useEmulatorTransition({
  isVisible: isVisibleRef,
  onCovered: () => {
    emit('covered', true);
  },
  onReset: () => {
    emit('covered', false);
  },
});

defineExpose({
  isCovered,
});
</script>

<style lang="scss" scoped>
@use '@/styles/variables/colors' as color-vars;
@use '@/styles/variables/radius' as radius-vars;

.emulator-overlay {
  position: fixed;
  inset: 0;
  background: transparent;
  backdrop-filter: none;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;

  &.is-covered {
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(4px);
    animation: chromatic-overlay-settle 380ms ease-out forwards;
  }
}

.transition-wipe-svg {
  position: fixed;
  inset: 0;
  z-index: 20;
  width: 100%;
  height: 100dvh;
  pointer-events: none;
  overflow: hidden;
  fill: none;
}

.wipe-path {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: chromatic-snake-wipe 500ms steps(30, jump-none) forwards;
}

@keyframes chromatic-snake-wipe {
  0% {
    stroke-dashoffset: 1;
  }
  100% {
    stroke-dashoffset: 0;
  }
}

@keyframes chromatic-overlay-settle {
  0% {
    background-color: var(--wipe-theme-color, var(--retro-accent, #BFA9E2));
    backdrop-filter: blur(0px);
  }
  100% {
    background-color: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(4px);
  }
}

.emulator-container {
  background: var(--retro-bg-surface);
  border: 1.5px solid var(--retro-border);
  border-radius: 6px;
  box-shadow: -4px 4px 0 var(--retro-shadow-color);
  overflow: hidden;
  width: min(540px, calc(100vw - 2rem));
  max-width: 90vw;
  max-height: calc(100vh - 2rem);
  display: flex;
  flex-direction: column;
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
  transition: opacity 380ms ease-out, visibility 380ms ease-out;

  &.is-revealed {
    visibility: visible;
    opacity: 1;
    pointer-events: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .transition-wipe-svg {
    display: none !important;
  }

  .wipe-path {
    animation: none !important;
  }

  .emulator-overlay {
    transition: none !important;
    animation: none !important;
  }

  .emulator-container {
    transition: none !important;
  }
}
</style>
