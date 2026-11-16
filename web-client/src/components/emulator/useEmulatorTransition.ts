import { onUnmounted, type Ref, ref, watch } from 'vue';

export interface UseEmulatorTransitionOptions {
  isVisible?: Ref<boolean>;
  onCovered?: () => void;
  onReset?: () => void;
}

export function useEmulatorTransition(options?: UseEmulatorTransitionOptions) {
  const isCovered = ref(false);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let rafId: number | null = null;

  function checkPrefersReducedMotion(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (rafId !== null && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function markCovered() {
    clearTimer();
    if (!isCovered.value) {
      isCovered.value = true;
      options?.onCovered?.();
    }
  }

  function start() {
    clearTimer();
    if (checkPrefersReducedMotion()) {
      isCovered.value = true;
      options?.onCovered?.();
      return;
    }

    isCovered.value = false;
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    timer = setTimeout(() => {
      markCovered();
    }, 500);

    // If main-thread work (e.g., ROM/WASM initialization) delays the first painted
    // frame in a real browser, re-anchor the fallback timer to the first painted frame
    // so the timer never cuts off the 500ms CSS SVG wipe before @animationend fires.
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        if (isCovered.value || timer === null) return;
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const mainThreadDelay = now - startTime;
        if (mainThreadDelay > 20) {
          clearTimeout(timer);
          timer = setTimeout(() => {
            markCovered();
          }, 550);
        }
      });
    }
  }

  function reset() {
    clearTimer();
    const reducedMotion = checkPrefersReducedMotion();
    isCovered.value = reducedMotion;
    options?.onReset?.();
  }

  function handleAnimationEnd(event?: AnimationEvent) {
    if (!event?.animationName || event.animationName.startsWith('chromatic-snake-wipe')) {
      markCovered();
    }
  }

  if (options?.isVisible) {
    watch(
      options.isVisible,
      (visible) => {
        if (visible) {
          start();
        } else {
          reset();
        }
      },
      { immediate: true },
    );
  }

  onUnmounted(() => {
    clearTimer();
  });

  return {
    isCovered,
    start,
    markCovered,
    reset,
    handleAnimationEnd,
    checkPrefersReducedMotion,
  };
}
