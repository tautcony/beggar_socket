<template>
  <div
    class="screen-viewport"
    :style="viewportStyle"
  >
    <transition name="shimmer-fade">
      <div
        v-if="!isReady"
        class="screen-loading-surface _3l0r5q_loadingSurface"
        aria-hidden="true"
      />
    </transition>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    isReady: boolean;
    aspectRatio?: string;
    maxWidth?: string;
  }>(),
  {
    aspectRatio: '240 / 160',
    maxWidth: 'min(480px, 100%)',
  },
);

const viewportStyle = computed(() => ({
  aspectRatio: props.aspectRatio,
  maxWidth: props.maxWidth,
}));
</script>

<style lang="scss" scoped>
.screen-viewport {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 100%;
  max-height: 100%;
  overflow: hidden;
  border-radius: inherit;
}

.screen-loading-surface {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 5;
  border-radius: inherit;
  background: #000000;

  &::before {
    content: "";
    background: linear-gradient(
      135deg,
      transparent 38%,
      rgba(255, 255, 255, 0.04) 40%,
      rgba(255, 255, 255, 0.12) 42%,
      rgba(255, 255, 255, 0.23) 44%,
      rgba(255, 255, 255, 0.33) 46%,
      rgba(255, 255, 255, 0.38) 48%,
      rgba(255, 255, 255, 0.40) 50%,
      rgba(255, 255, 255, 0.38) 52%,
      rgba(255, 255, 255, 0.33) 54%,
      rgba(255, 255, 255, 0.23) 56%,
      rgba(255, 255, 255, 0.12) 58%,
      rgba(255, 255, 255, 0.04) 60%,
      transparent 62%
    );
    will-change: transform;
    animation: chromatic-loading-sweep 4s linear 0s infinite normal none running;
    position: absolute;
    inset: -50%;
  }
}

@keyframes chromatic-loading-sweep {
  0% {
    transform: translate(-33%, -33%);
  }
  100% {
    transform: translate(33%, 33%);
  }
}

.shimmer-fade-leave-active {
  transition: opacity 250ms cubic-bezier(0.33, 1, 0.68, 1);
}

.shimmer-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .screen-loading-surface::before {
    animation: none !important;
  }

  .shimmer-fade-leave-active {
    transition: none !important;
  }
}
</style>
